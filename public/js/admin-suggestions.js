import { supabase } from './auth.js';
import { escapeHtml, showToast } from './main.js';
import {
  VALID_SUGGESTION_STATUSES,
  formatCategoryLabel,
  computeSuggestionStats,
  filterAndSortSuggestions,
  validateSuggestionUpdate,
  formatCsvCell,
  buildSuggestionsCsv
} from './admin-utils.js';

export {
  formatCategoryLabel,
  computeSuggestionStats,
  filterAndSortSuggestions,
  validateSuggestionUpdate,
  formatCsvCell,
  buildSuggestionsCsv
};

const VALID_STATUSES = VALID_SUGGESTION_STATUSES;

let allSuggestions = [];
let filteredSuggestions = [];
const savingIds = new Set();

const list = document.getElementById('adminSuggestionsList');
const count = document.getElementById('adminSuggestionsCount');
const resultSummary = document.getElementById('adminSuggestionsResultSummary');
const statusFilter = document.getElementById('suggestionStatusFilter');
const categoryFilter = document.getElementById('suggestionCategoryFilter');
const sortOrder = document.getElementById('suggestionSortOrder');
const searchInput = document.getElementById('suggestionSearchInput');
const clearFiltersBtn = document.getElementById('clearSuggestionFiltersBtn');
const refreshBtn = document.getElementById('refreshSuggestionsBtn');
const exportCsvBtn = document.getElementById('exportSuggestionsCsvBtn');
const notice = document.getElementById('adminSuggestionsNotice');

function setNotice(message, error = false) {
  if (!notice) return;
  notice.textContent = message;
  notice.className = error ? 'admin-suggestion-notice is-error' : 'admin-suggestion-notice';
}

function dateLabel(value) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function renderStats() {
  const stats = computeSuggestionStats(allSuggestions);
  const setStat = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = new Intl.NumberFormat('en-MW').format(val);
  };
  setStat('statTotalSuggestions', stats.total);
  setStat('statNewSuggestions', stats.newCount);
  setStat('statReviewingSuggestions', stats.reviewingCount);
  setStat('statResolvedSuggestions', stats.resolvedCount);

  const breakdown = document.getElementById('statResolvedBreakdown');
  if (breakdown) {
    breakdown.textContent = `${stats.respondedCount} responded · ${stats.closedCount} closed`;
  }
}

function getActiveFilterOptions() {
  return {
    search: searchInput?.value || '',
    status: statusFilter?.value || 'all',
    category: categoryFilter?.value || 'all',
    sort: sortOrder?.value || 'newest'
  };
}

function applyFiltersAndRender() {
  const opts = getActiveFilterOptions();
  filteredSuggestions = filterAndSortSuggestions(allSuggestions, opts);
  renderStats();
  render(filteredSuggestions);
}

function render(items) {
  if (!list) return;
  if (count) count.textContent = String(items.length);
  if (resultSummary) {
    resultSummary.textContent = allSuggestions.length
      ? `Showing ${items.length} of ${allSuggestions.length} suggestion${allSuggestions.length === 1 ? '' : 's'}`
      : 'No suggestions recorded yet';
  }

  if (!items.length) {
    const emptyMsg = allSuggestions.length
      ? 'No farmer suggestions match the selected search or filters.'
      : 'No farmer suggestions have been submitted yet.';
    list.innerHTML = `<div class="admin-suggestion-empty">${escapeHtml(emptyMsg)}</div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const safeId = escapeHtml(item.id || '');
    const safeStatus = VALID_STATUSES.has(item.status) ? item.status : 'new';
    const categoryText = formatCategoryLabel(item.category);
    const createdText = dateLabel(item.created_at);
    const hasUpdate = item.updated_at && item.created_at && item.updated_at !== item.created_at;
    const isSaving = savingIds.has(String(item.id));

    return `
      <article class="admin-suggestion-item" data-id="${safeId}" data-prev-status="${escapeHtml(safeStatus)}">
        <div class="admin-suggestion-item-head">
          <div>
            <span class="admin-eyebrow">${escapeHtml(categoryText)} · Submitted ${escapeHtml(createdText)}</span>
            <h3>${escapeHtml(item.subject || 'Untitled suggestion')}</h3>
          </div>
          <span class="suggestion-status suggestion-status-${escapeHtml(safeStatus)}">${escapeHtml(safeStatus.replace('_', ' '))}</span>
        </div>

        <p class="admin-suggestion-message">${escapeHtml(item.message || '')}</p>

        <div class="admin-suggestion-meta-grid">
          <div><span>Submission ID</span><code>${safeId || 'Unavailable'}</code></div>
          <div><span>Farmer account ID</span><code>${escapeHtml(item.user_id || 'Unavailable')}</code></div>
          <div><span>Submitted</span><strong>${escapeHtml(createdText)}</strong></div>
          <div><span>Last updated</span><strong>${escapeHtml(hasUpdate ? dateLabel(item.updated_at) : createdText)}</strong></div>
        </div>

        ${item.admin_response ? `
          <div class="admin-suggestion-existing-reply">
            <strong>Current saved response</strong>
            <p>${escapeHtml(item.admin_response)}</p>
          </div>
        ` : ''}

        <label for="suggestion-response-${safeId}">Administrator response</label>
        <textarea
          id="suggestion-response-${safeId}"
          rows="3"
          maxlength="3000"
          placeholder="Write a clear, helpful response for the farmer…"
          ${isSaving ? 'disabled' : ''}
        >${escapeHtml(item.admin_response || '')}</textarea>

        <div class="admin-suggestion-card-feedback" role="status" aria-live="polite" hidden></div>

        <div class="admin-suggestion-actions">
          <label class="admin-suggestion-status-label">Status
            <select class="suggestion-row-status" ${isSaving ? 'disabled' : ''}>
              <option value="new" ${safeStatus === 'new' ? 'selected' : ''}>New</option>
              <option value="reviewing" ${safeStatus === 'reviewing' ? 'selected' : ''}>Reviewing</option>
              <option value="responded" ${safeStatus === 'responded' ? 'selected' : ''}>Responded</option>
              <option value="closed" ${safeStatus === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary save-suggestion" ${isSaving ? 'disabled' : ''}>
            ${isSaving ? 'Saving…' : 'Save response'}
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadSuggestions({ showSuccessNotice = false } = {}) {
  setNotice('Loading farmer suggestions…');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing…';
  }

  try {
    const { data, error } = await supabase
      .from('farmer_suggestions')
      .select('id,user_id,category,subject,message,status,admin_response,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin suggestions:', error);
      allSuggestions = [];
      filteredSuggestions = [];
      renderStats();
      if (count) count.textContent = '0';
      if (resultSummary) resultSummary.textContent = 'Unable to load suggestions';
      setNotice('Suggestions could not be loaded: ' + (error.message || 'Check database permissions and admin_access.'), true);
      if (list) list.innerHTML = '<div class="admin-suggestion-empty">Unable to load farmer suggestions. Please refresh or confirm database access.</div>';
      return;
    }

    allSuggestions = Array.isArray(data) ? data : [];
    applyFiltersAndRender();
    setNotice(
      showSuccessNotice
        ? `Refreshed suggestions (${allSuggestions.length} total).`
        : (allSuggestions.length
            ? 'Showing verified farmer suggestions from the database.'
            : 'No farmer suggestions have been submitted yet.')
    );
  } catch (err) {
    console.error('Admin suggestions network error:', err);
    setNotice('Network error while loading suggestions. Please check your connection and try again.', true);
    if (list && !allSuggestions.length) {
      list.innerHTML = '<div class="admin-suggestion-empty">Unable to reach the database right now.</div>';
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻ Refresh';
    }
  }
}

async function syncServerSessionFromSupabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'X-Requested-With': 'fetch'
      },
      body: JSON.stringify({ accessToken: session.access_token })
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => ({}));
    return payload.authenticated ? payload.user : null;
  } catch {
    return null;
  }
}

async function verifyAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    window.location.replace('../login.html?redirect=' + encodeURIComponent(window.location.pathname) + '&admin=true');
    return false;
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_access')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError || !admin) {
    setNotice('This account is not listed in admin_access. Access denied.', true);
    window.location.replace('../login.html?redirect=' + encodeURIComponent(window.location.pathname) + '&admin=true');
    return false;
  }

  let response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
  let session = response.ok ? await response.json().catch(() => ({})) : null;

  if (!session?.authenticated) {
    const syncedUser = await syncServerSessionFromSupabase();
    if (!syncedUser) {
      window.location.replace('../login.html?redirect=' + encodeURIComponent(window.location.pathname) + '&admin=true');
      return false;
    }
  }

  return true;
}

function setCardFeedback(card, message, isError = false) {
  const feedback = card?.querySelector('.admin-suggestion-card-feedback');
  if (!feedback) return;
  if (!message) {
    feedback.hidden = true;
    feedback.textContent = '';
    feedback.className = 'admin-suggestion-card-feedback';
    return;
  }
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.className = isError
    ? 'admin-suggestion-card-feedback is-error'
    : 'admin-suggestion-card-feedback is-success';
}

function exportFilteredCsv() {
  if (!filteredSuggestions.length) {
    setNotice('No suggestions match the current filter to export.', true);
    showToast('No filtered suggestions to export.');
    return;
  }

  const csvContent = '\uFEFF' + buildSuggestionsCsv(filteredSuggestions);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `ulimi-farmer-suggestions-${dateStamp}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast(`Exported ${filteredSuggestions.length} suggestion${filteredSuggestions.length === 1 ? '' : 's'} to CSV.`);
}

list?.addEventListener('click', async event => {
  const button = event.target.closest('.save-suggestion');
  if (!button) return;

  const card = button.closest('.admin-suggestion-item');
  const id = card?.dataset.id;
  if (!id || savingIds.has(id)) return;

  const textarea = card.querySelector('textarea');
  const statusSelect = card.querySelector('.suggestion-row-status');
  const existingItem = allSuggestions.find(item => String(item.id) === String(id));

  const validation = validateSuggestionUpdate({
    responseText: textarea?.value || '',
    nextStatus: statusSelect?.value || existingItem?.status || 'new',
    previousStatus: existingItem?.status || card.dataset.prevStatus || 'new',
    existingResponse: existingItem?.admin_response || null
  });

  if (!validation.ok) {
    setCardFeedback(card, validation.message, true);
    setNotice(validation.message, true);
    textarea?.focus();
    return;
  }

  savingIds.add(id);
  setCardFeedback(card, '');
  button.disabled = true;
  button.textContent = 'Saving…';
  if (textarea) textarea.disabled = true;
  if (statusSelect) statusSelect.disabled = true;

  try {
    const { data, error } = await supabase
      .from('farmer_suggestions')
      .update({
        admin_response: validation.admin_response,
        status: validation.status
      })
      .eq('id', id)
      .select('id,user_id,category,subject,message,status,admin_response,created_at,updated_at');

    if (error || !Array.isArray(data) || data.length !== 1) {
      const msg = error?.message
        ? `Could not save response: ${error.message}`
        : 'Response was not saved. Confirm administrator permissions and reload.';
      setCardFeedback(card, msg, true);
      setNotice(msg, true);
      showToast('Failed to save suggestion response.');
      return;
    }

    const updatedRecord = data[0];
    allSuggestions = allSuggestions.map(item => (String(item.id) === String(id) ? updatedRecord : item));
    applyFiltersAndRender();
    setNotice('Admin response and suggestion status saved successfully.');
    showToast('Suggestion response saved.');

    const refreshedCard = list.querySelector(`.admin-suggestion-item[data-id="${CSS.escape(String(id))}"]`);
    if (refreshedCard) {
      setCardFeedback(refreshedCard, 'Saved to database.', false);
    }
  } catch (err) {
    console.error('Save suggestion error:', err);
    const msg = 'Network error while saving response. Your draft has not been lost — please try again.';
    setCardFeedback(card, msg, true);
    setNotice(msg, true);
    showToast('Network error saving response.');
  } finally {
    savingIds.delete(id);
    if (card.isConnected) {
      button.disabled = false;
      button.textContent = 'Save response';
      if (textarea) textarea.disabled = false;
      if (statusSelect) statusSelect.disabled = false;
    }
  }
});

searchInput?.addEventListener('input', applyFiltersAndRender);
statusFilter?.addEventListener('change', applyFiltersAndRender);
categoryFilter?.addEventListener('change', applyFiltersAndRender);
sortOrder?.addEventListener('change', applyFiltersAndRender);

clearFiltersBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = 'all';
  if (categoryFilter) categoryFilter.value = 'all';
  if (sortOrder) sortOrder.value = 'newest';
  applyFiltersAndRender();
});

refreshBtn?.addEventListener('click', () => loadSuggestions({ showSuccessNotice: true }));
exportCsvBtn?.addEventListener('click', exportFilteredCsv);

document.getElementById('adminLogoutBtn')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'fetch' }
    });
  } catch (_) {}
  try { await supabase.auth.signOut(); } catch (_) {}
  window.location.assign('../login.html?admin=true');
});

if (typeof document !== 'undefined' && list) {
  (async () => {
    if (await verifyAdmin()) {
      await loadSuggestions();
    }
  })();
}
