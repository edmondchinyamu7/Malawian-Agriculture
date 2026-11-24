import { supabase } from './auth.js';
import { escapeHtml } from './main.js';

const list = document.getElementById('adminSuggestionsList');
const count = document.getElementById('adminSuggestionsCount');
const statusFilter = document.getElementById('suggestionStatusFilter');
const categoryFilter = document.getElementById('suggestionCategoryFilter');
const searchInput = document.getElementById('suggestionSearch');
const sortSelect = document.getElementById('suggestionSort');
const notice = document.getElementById('adminSuggestionsNotice');
const resultsText = document.getElementById('suggestionResultsText');
const refreshButton = document.getElementById('refreshSuggestionsBtn');
const exportButton = document.getElementById('exportSuggestionsBtn');
let suggestions = [];
let isLoading = false;

const statusLabels = { new: 'New', reviewing: 'Reviewing', responded: 'Responded', closed: 'Closed' };

function setNotice(message, error = false) {
  if (!notice) return;
  notice.textContent = message;
  notice.className = error ? 'admin-suggestion-notice is-error' : 'admin-suggestion-notice';
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function updateStats() {
  const total = suggestions.length;
  const byStatus = key => suggestions.filter(item => item.status === key).length;
  document.getElementById('suggestionStatTotal').textContent = total;
  document.getElementById('suggestionStatNew').textContent = byStatus('new');
  document.getElementById('suggestionStatReviewing').textContent = byStatus('reviewing');
  document.getElementById('suggestionStatDone').textContent = byStatus('responded') + byStatus('closed');
}

function populateCategories() {
  const current = categoryFilter.value;
  const categories = [...new Set(suggestions.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  categoryFilter.innerHTML = '<option value="all">All categories</option>' + categories.map(category =>
    '<option value="' + escapeHtml(category) + '">' + escapeHtml(category.replaceAll('_', ' ')) + '</option>'
  ).join('');
  categoryFilter.value = categories.includes(current) ? current : 'all';
}

function getFilteredSuggestions() {
  const term = searchInput.value.trim().toLocaleLowerCase();
  const status = statusFilter.value;
  const category = categoryFilter.value;
  const filtered = suggestions.filter(item => {
    const matchesStatus = status === 'all' || item.status === status;
    const matchesCategory = category === 'all' || item.category === category;
    const haystack = [item.subject, item.message, item.user_id, item.category, item.admin_response].join(' ').toLocaleLowerCase();
    return matchesStatus && matchesCategory && (!term || haystack.includes(term));
  });
  filtered.sort((a, b) => {
    const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortSelect.value === 'oldest' ? difference : -difference;
  });
  return filtered;
}

function render() {
  if (!list) return;
  const items = getFilteredSuggestions();
  count.textContent = String(items.length);
  resultsText.textContent = 'Showing ' + items.length + ' of ' + suggestions.length + ' suggestions';
  if (!items.length) {
    list.innerHTML = '<div class="admin-suggestion-empty"><strong>No suggestions found.</strong><span>Try changing your search or filters.</span></div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const category = String(item.category || 'general').replaceAll('_', ' ');
    const status = statusLabels[item.status] || item.status || 'Unknown';
    return `
      <article class="admin-suggestion-item ${item.status === 'new' ? 'is-new' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="admin-suggestion-item-head">
          <div class="admin-suggestion-title">
            <span class="admin-eyebrow">${escapeHtml(category)} · ${escapeHtml(dateLabel(item.created_at))}</span>
            <h3>${escapeHtml(item.subject || 'Untitled suggestion')}</h3>
          </div>
          <span class="suggestion-status suggestion-status-${escapeHtml(item.status)}">${escapeHtml(status)}</span>
        </div>
        <p class="admin-suggestion-message">${escapeHtml(item.message || '')}</p>
        <details class="admin-suggestion-details">
          <summary>Submission details</summary>
          <div class="admin-suggestion-meta">Farmer account ID: <code>${escapeHtml(item.user_id || 'Unavailable')}</code></div>
          <div class="admin-suggestion-meta">Submitted: ${escapeHtml(dateLabel(item.created_at))}</div>
        </details>
        <label for="suggestion-response-${escapeHtml(item.id)}">Admin response</label>
        <textarea id="suggestion-response-${escapeHtml(item.id)}" rows="3" maxlength="3000" placeholder="Write a clear, helpful response to the farmer…">${escapeHtml(item.admin_response || '')}</textarea>
        <div class="admin-suggestion-actions">
          <label class="admin-suggestion-status-label">Status
            <select class="suggestion-row-status">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
              <option value="reviewing" ${item.status === 'reviewing' ? 'selected' : ''}>Reviewing</option>
              <option value="responded" ${item.status === 'responded' ? 'selected' : ''}>Responded</option>
              <option value="closed" ${item.status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary save-suggestion">Save changes</button>
        </div>
      </article>`;
  }).join('');
}

async function loadSuggestions() {
  if (isLoading) return;
  isLoading = true;
  refreshButton.disabled = true;
  setNotice('Loading farmer suggestions…');
  const { data, error } = await supabase.from('farmer_suggestions')
    .select('id,user_id,category,subject,message,status,admin_response,created_at')
    .order('created_at', { ascending: false });
  isLoading = false;
  refreshButton.disabled = false;
  if (error) {
    console.error('Admin suggestions:', error);
    setNotice('Suggestions could not be loaded. Confirm the existing database migration and administrator permissions.', true);
    list.innerHTML = '<div class="admin-suggestion-empty">Unable to load suggestions. Please refresh and try again.</div>';
    return;
  }
  suggestions = Array.isArray(data) ? data : [];
  updateStats();
  populateCategories();
  render();
  setNotice('Suggestions loaded. Changes are saved to the existing farmer suggestions records.');
}

async function verifyAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    setNotice('Sign in with the administrator Supabase account to view suggestions.', true);
    return false;
  }
  const { data: admin, error: adminError } = await supabase.from('admin_access')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (adminError || !admin) {
    setNotice('This account is not linked to admin_access. Access denied.', true);
    return false;
  }
  const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    setNotice('Your server administrator session is not active. Please sign in again.', true);
    return false;
  }
  const session = await response.json();
  if (!session?.authenticated) {
    setNotice('Your administrator session could not be verified. Please sign in again.', true);
    return false;
  }
  return true;
}

function csvCell(value) {
  return '"' + String(value ?? '').replaceAll('"', '""').replace(/[\r\n]+/g, ' ') + '"';
}

function exportCsv() {
  const items = getFilteredSuggestions();
  if (!items.length) {
    setNotice('There are no suggestions in the current view to export.', true);
    return;
  }
  const columns = ['id', 'created_at', 'category', 'subject', 'message', 'status', 'admin_response', 'user_id'];
  const csv = [columns.join(','), ...items.map(item => columns.map(key => csvCell(item[key])).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ulimi-farmer-suggestions-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setNotice('CSV export prepared for the suggestions currently shown.');
}

list?.addEventListener('click', async event => {
  const button = event.target.closest('.save-suggestion');
  if (!button) return;
  const card = button.closest('.admin-suggestion-item');
  const id = card?.dataset.id;
  if (!id) return;
  const responseText = card.querySelector('textarea').value.trim();
  const status = card.querySelector('.suggestion-row-status').value;
  if (status === 'responded' && !responseText) {
    setNotice('Add an admin response before marking a suggestion as responded.', true);
    card.querySelector('textarea').focus();
    return;
  }
  button.disabled = true;
  button.textContent = 'Saving…';
  const { error } = await supabase.from('farmer_suggestions')
    .update({ admin_response: responseText || null, status })
    .eq('id', id);
  button.disabled = false;
  button.textContent = 'Save changes';
  if (error) {
    console.error('Save farmer suggestion:', error);
    setNotice('Could not save these changes. Check administrator permissions and try again.', true);
    return;
  }
  setNotice('Suggestion response and status saved successfully.');
  await loadSuggestions();
});

[searchInput, statusFilter, categoryFilter, sortSelect].forEach(control => control?.addEventListener('input', render));
[statusFilter, categoryFilter, sortSelect].forEach(control => control?.addEventListener('change', render));
refreshButton?.addEventListener('click', loadSuggestions);
exportButton?.addEventListener('click', exportCsv);
document.getElementById('clearSuggestionFilters')?.addEventListener('click', () => {
  searchInput.value = '';
  statusFilter.value = 'all';
  categoryFilter.value = 'all';
  sortSelect.value = 'newest';
  render();
});

document.getElementById('adminLogoutBtn')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
  try { await supabase.auth.signOut(); } catch (_) {}
  window.location.assign('../login.html?admin=true');
});

(async () => {
  if (await verifyAdmin()) await loadSuggestions();
})();
