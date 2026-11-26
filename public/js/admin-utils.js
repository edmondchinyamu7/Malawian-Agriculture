export const SUGGESTION_CATEGORY_LABELS = {
  website: 'Website experience',
  market_prices: 'Market prices',
  crops_and_farming: 'Crops & farming information',
  farmer_support: 'Farmer support',
  other: 'Other'
};

export const VALID_SUGGESTION_STATUSES = new Set(['new', 'reviewing', 'responded', 'closed']);

export function formatCategoryLabel(category) {
  const key = String(category || 'other');
  return SUGGESTION_CATEGORY_LABELS[key] || key.replaceAll('_', ' ');
}

export function computeSuggestionStats(items) {
  const rows = Array.isArray(items) ? items : [];
  let newCount = 0;
  let reviewingCount = 0;
  let respondedCount = 0;
  let closedCount = 0;

  for (const item of rows) {
    if (item?.status === 'new') newCount++;
    else if (item?.status === 'reviewing') reviewingCount++;
    else if (item?.status === 'responded') respondedCount++;
    else if (item?.status === 'closed') closedCount++;
  }

  return {
    total: rows.length,
    newCount,
    reviewingCount,
    respondedCount,
    closedCount,
    resolvedCount: respondedCount + closedCount
  };
}

export function filterAndSortSuggestions(items, options = {}) {
  const rows = Array.isArray(items) ? [...items] : [];
  const query = String(options.search || '').trim().toLowerCase();
  const status = String(options.status || 'all');
  const category = String(options.category || 'all');
  const sort = options.sort === 'oldest' ? 'oldest' : 'newest';

  const filtered = rows.filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (status !== 'all' && item.status !== status) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (!query) return true;

    const categoryLabel = formatCategoryLabel(item.category);
    const haystack = [
      item.id,
      item.user_id,
      item.category,
      categoryLabel,
      item.subject,
      item.message,
      item.status,
      item.admin_response
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  filtered.sort((a, b) => {
    const tA = Date.parse(a?.created_at || '') || 0;
    const tB = Date.parse(b?.created_at || '') || 0;
    return sort === 'oldest' ? tA - tB : tB - tA;
  });

  return filtered;
}

export function validateSuggestionUpdate({ responseText, nextStatus, previousStatus, existingResponse }) {
  const trimmed = String(responseText ?? '').trim();
  const status = VALID_SUGGESTION_STATUSES.has(nextStatus) ? nextStatus : 'new';

  if (trimmed.length > 3000) {
    return {
      ok: false,
      message: 'Administrator response cannot exceed 3,000 characters.'
    };
  }

  if (status === 'responded' && !trimmed) {
    return {
      ok: false,
      message: 'Please write an administrator response before marking this suggestion as Responded.'
    };
  }

  const isStatusTransitionOnly = (
    !trimmed &&
    status !== previousStatus &&
    (status === 'reviewing' || status === 'closed')
  );

  if (!trimmed && !isStatusTransitionOnly) {
    return {
      ok: false,
      message: 'Please write an administrator response before saving, or change status to Reviewing / Closed.'
    };
  }

  const nextResponse = trimmed || (existingResponse ? String(existingResponse).trim() : '') || null;
  return {
    ok: true,
    status,
    admin_response: nextResponse
  };
}

export function formatCsvCell(value) {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildSuggestionsCsv(items) {
  const headers = [
    'Submission ID',
    'Farmer Account ID',
    'Category',
    'Subject',
    'Message',
    'Status',
    'Admin Response',
    'Submitted At',
    'Updated At'
  ];

  const rows = (Array.isArray(items) ? items : []).map(item => [
    item?.id || '',
    item?.user_id || '',
    formatCategoryLabel(item?.category),
    item?.subject || '',
    item?.message || '',
    item?.status || '',
    item?.admin_response || '',
    item?.created_at || '',
    item?.updated_at || item?.created_at || ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(formatCsvCell).join(','))
    .join('\r\n');
}

export function computeMarketPriceStats(items) {
  const rows = Array.isArray(items) ? items : [];
  let verified = 0;
  let pending = 0;
  let rejected = 0;
  for (const row of rows) {
    if (row?.status === 'verified') verified++;
    else if (row?.status === 'pending') pending++;
    else if (row?.status === 'rejected') rejected++;
  }
  return {
    total: rows.length,
    verified,
    pending,
    rejected
  };
}

export function filterMarketPriceRows(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  const query = String(options.search || '').trim().toLowerCase();
  const status = String(options.status || 'all');
  const source = String(options.source || 'all');

  return rows.filter(row => {
    if (!row || typeof row !== 'object') return false;
    const rowStatus = String(row.status || 'pending');
    const rowSource = String(row.source_type || 'admin');

    if (status !== 'all' && rowStatus !== status) return false;
    if (source !== 'all' && rowSource !== source) return false;
    if (!query) return true;

    const haystack = [
      row.crop_name,
      row.category,
      row.market_name,
      row.district,
      row.region,
      row.unit,
      row.reporter_name,
      row.source_name,
      row.notes,
      rowStatus,
      rowSource
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}
