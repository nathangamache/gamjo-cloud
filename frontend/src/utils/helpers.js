import config from '../config.json';

// Template: replace {{token}} placeholders with values
export function t(template, vars = {}) {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// Pick random item from array (uncached, for one-off use)
export function pick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// Cache for msg() - stable random picks per page load
const _msgCache = new Map();

// Pick and fill a template from config (cached per path per page load)
// Use msg('path') for stable UI text that shouldn't change on re-render
// Use msg('path', vars, true) to force a fresh pick (e.g. toasts)
export function msg(path, vars = {}, fresh = false) {
  const parts = path.split('.');
  let val = config;
  for (const p of parts) { val = val?.[p]; }
  if (Array.isArray(val)) {
    let picked;
    if (fresh || !_msgCache.has(path)) {
      picked = pick(val);
      if (!fresh) _msgCache.set(path, picked);
    } else {
      picked = _msgCache.get(path);
    }
    return t(picked, vars);
  }
  if (typeof val === 'string') return t(val, vars);
  return '';
}

export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatFullDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDateRange(s, e) {
  if (!s || !e) return '';
  const sd = new Date(s + 'T12:00:00');
  const ed = new Date(e + 'T12:00:00');
  const sm = sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const em = ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sm} \u2013 ${em}`;
}

export function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function formatTime12h(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')}${ampm}`;
}

export function formatMoneyShort(n) {
  return `$${Math.round(Number(n || 0))}`;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function groupBy(arr, keyFn) {
  const map = {};
  arr.forEach(item => {
    const key = keyFn(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

// Parse fraction input like "1/3" -> 33.33333..., or plain number "33.3" -> 33.3
export function parseFraction(input) {
  if (!input) return 0;
  const s = String(input).trim();
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(x => parseFloat(x.trim()));
    if (!den || isNaN(num) || isNaN(den)) return 0;
    return (num / den) * 100;
  }
  return parseFloat(s) || 0;
}

// Display a percentage nicely: 33.33333 -> "33.3%", 50 -> "50%"
export function formatPct(val) {
  if (!val && val !== 0) return '0%';
  const n = Number(val);
  // If it's a clean number, show fewer decimals
  if (Math.abs(n - Math.round(n)) < 0.01) return `${Math.round(n)}%`;
  return `${n.toFixed(1)}%`;
}

// Convert a stored percentage back to fraction display if it's a common fraction
export function pctToFractionStr(val) {
  const n = Number(val);
  const fractions = [[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6]];
  for (const [num, den] of fractions) {
    if (Math.abs(n - (num / den) * 100) < 0.01) return `${num}/${den}`;
  }
  return String(n);
}

// Derive trip status automatically from dates
export function getTripStatus(trip) {
  if (!trip?.start_date || !trip?.end_date) return 'draft';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(trip.start_date + 'T00:00:00');
  const end = new Date(trip.end_date + 'T23:59:59');
  if (today < start) return 'upcoming';
  if (today <= end) return 'active';
  return 'completed';
}

export function getTripStatusLabel(trip) {
  const s = getTripStatus(trip);
  return { draft: 'Draft', upcoming: 'Upcoming', active: 'Active', completed: 'Completed' }[s] || s;
}