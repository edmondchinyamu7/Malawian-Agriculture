import { supabase } from './auth.js';
import { escapeHtml } from './main.js';

const list = document.getElementById('adminSuggestionsList');
const count = document.getElementById('adminSuggestionsCount');
const filter = document.getElementById('suggestionStatusFilter');
const notice = document.getElementById('adminSuggestionsNotice');

function setNotice(message, error = false) {
  if (!notice) return;
  notice.textContent = message;
  notice.className = error ? 'admin-suggestion-notice is-error' : 'admin-suggestion-notice';
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function render(items) {
  if (!list) return;
  if (count) count.textContent = String(items.length);
  if (!items.length) {
    list.innerHTML = '<div class="admin-suggestion-empty">No suggestions match this filter.</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <article class="admin-suggestion-item" data-id="${escapeHtml(item.id)}">
      <div class="admin-suggestion-item-head">
        <div><span class="admin-eyebrow">${escapeHtml(item.category.replaceAll('_',' '))} · ${escapeHtml(dateLabel(item.created_at))}</span><h3>${escapeHtml(item.subject)}</h3></div>
        <span class="suggestion-status suggestion-status-${escapeHtml(item.status)}">${escapeHtml(item.status.replace('_',' '))}</span>
      </div>
      <p class="admin-suggestion-message">${escapeHtml(item.message)}</p>
      <div class="admin-suggestion-meta">Farmer account: <code>${escapeHtml(item.user_id)}</code></div>
      <label for="suggestion-response-${escapeHtml(item.id)}">Admin response</label>
      <textarea id="suggestion-response-${escapeHtml(item.id)}" rows="3" maxlength="3000" placeholder="Write a response to the farmer…">${escapeHtml(item.admin_response || '')}</textarea>
      <div class="admin-suggestion-actions">
        <label class="admin-suggestion-status-label">Status
          <select class="suggestion-row-status">
            <option value="new" ${item.status==='new'?'selected':''}>New</option>
            <option value="reviewing" ${item.status==='reviewing'?'selected':''}>Reviewing</option>
            <option value="responded" ${item.status==='responded'?'selected':''}>Responded</option>
            <option value="closed" ${item.status==='closed'?'selected':''}>Closed</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary save-suggestion">Save response</button>
      </div>
    </article>`).join('');
}

async function loadSuggestions() {
  setNotice('Loading farmer suggestions…');
  const { data, error } = await supabase.from('farmer_suggestions')
    .select('id,user_id,category,subject,message,status,admin_response,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Admin suggestions:', error);
    setNotice('Suggestions could not be loaded. Confirm the database migration is applied and this admin account is linked in admin_access.', true);
    list.innerHTML = '<div class="admin-suggestion-empty">Unable to load suggestions.</div>';
    return;
  }
  const selected = filter?.value || 'all';
  const filtered = selected === 'all' ? data : data.filter(item => item.status === selected);
  render(filtered);
  setNotice('Showing the latest suggestions submitted by farmers.');
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

list?.addEventListener('click', async event => {
  const button = event.target.closest('.save-suggestion');
  if (!button) return;
  const card = button.closest('.admin-suggestion-item');
  const id = card?.dataset.id;
  if (!id) return;
  button.disabled = true;
  const response = card.querySelector('textarea').value.trim();
  const status = card.querySelector('.suggestion-row-status').value;
  const { error } = await supabase.from('farmer_suggestions')
    .update({ admin_response: response || null, status })
    .eq('id', id);
  button.disabled = false;
  if (error) {
    setNotice('Could not save this response. Check administrator permissions and try again.', true);
    return;
  }
  setNotice('Admin response and suggestion status saved.');
  await loadSuggestions();
});

filter?.addEventListener('change', loadSuggestions);

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
