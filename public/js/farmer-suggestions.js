import { supabase } from './auth.js';
import { escapeHtml, showToast } from './main.js';

const form = document.getElementById('farmerSuggestionForm');
const statusEl = document.getElementById('farmerSuggestionStatus');
const historyEl = document.getElementById('farmerSuggestionHistory');

function setStatus(message, kind = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = 'suggestion-feedback' + (kind ? ' ' + kind : '');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderHistory(items) {
  if (!historyEl) return;
  if (!items?.length) {
    historyEl.innerHTML = '<p class="suggestion-muted">You have not sent any suggestions yet.</p>';
    return;
  }
  historyEl.innerHTML = items.map(item => `
    <article class="suggestion-history-item">
      <div class="suggestion-history-top">
        <strong>${escapeHtml(item.subject)}</strong>
        <span class="suggestion-status suggestion-status-${escapeHtml(item.status)}">${escapeHtml(item.status.replace('_',' '))}</span>
      </div>
      <p>${escapeHtml(item.message)}</p>
      <small>${escapeHtml(item.category.replaceAll('_',' '))} · ${escapeHtml(formatDate(item.created_at))}</small>
      ${item.admin_response ? `<div class="suggestion-admin-reply"><strong>Admin response</strong><p>${escapeHtml(item.admin_response)}</p></div>` : ''}
    </article>`).join('');
}

async function init() {
  if (!form) return;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    setStatus('Please sign in to send a suggestion. Your message will be linked to your farmer account.', 'error');
    form.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
    return;
  }

  if (historyEl) {
    const { data, error } = await supabase.from('farmer_suggestions')
      .select('id,category,subject,message,status,admin_response,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (error) {
      historyEl.innerHTML = '<p class="suggestion-muted">Your suggestion history is temporarily unavailable.</p>';
      console.error('Suggestion history:', error);
    } else renderHistory(data);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const payload = {
      user_id: user.id,
      category: form.elements.category.value,
      subject: form.elements.subject.value.trim(),
      message: form.elements.message.value.trim()
    };
    if (payload.subject.length < 4 || payload.message.length < 10) {
      setStatus('Please add a clear subject and at least 10 characters describing your suggestion.', 'error');
      return;
    }
    submit.disabled = true;
    setStatus('Sending your suggestion…');
    const { error } = await supabase.from('farmer_suggestions').insert(payload);
    submit.disabled = false;
    if (error) {
      console.error('Suggestion submission:', error);
      setStatus(error.code === '42P01' || error.code === 'PGRST205'
        ? 'Suggestions are not available yet. Please try again after the feature is enabled.'
        : 'Your suggestion could not be sent. Please try again.', 'error');
      return;
    }
    form.reset();
    setStatus('Thank you. Your suggestion has been sent to the Ulimi wa Malawi admin team.', 'success');
    showToast('Suggestion sent to the admin team.');
    if (historyEl) {
      const { data } = await supabase.from('farmer_suggestions')
        .select('id,category,subject,message,status,admin_response,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      renderHistory(data || []);
    }
  });
}

init();
