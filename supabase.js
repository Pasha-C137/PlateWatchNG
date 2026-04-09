// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PlateWatchNG — Supabase Config & Utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SUPABASE_URL  = 'https://eptmdcecnukzicflasvj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdG1kY2VjbnVremljZmxhc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTA5MzEsImV4cCI6MjA5MTIyNjkzMX0.oqW_FsrVz4GGcdMroPgMM7KCbAp605QDP7xRQis-HTo';

// ── initialise client (loaded via CDN on each page) ──
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── get all VERIFIED reports for a plate ──
async function getReportsByPlate(plateNumber) {
  const { data, error } = await _supabase
    .from('reports')
    .select('*')
    .eq('plate_number', plateNumber.toUpperCase().trim())
    .eq('verified', true)
    .order('created_at', { ascending: false });
  if (error) { console.error('getReportsByPlate:', error); return []; }
  return data;
}

// ── get recent verified reports (for homepage feed) ──
async function getRecentReports(limit = 12) {
  const { data, error } = await _supabase
    .from('reports')
    .select('*')
    .eq('verified', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getRecentReports:', error); return []; }
  return data;
}

// ── get platform stats ──
async function getStats() {
  const [{ count: totalReports }, { count: totalPlates }] = await Promise.all([
    _supabase.from('reports').select('*', { count: 'exact', head: true }).eq('verified', true),
    _supabase.from('reports').select('plate_number', { count: 'exact', head: true }).eq('verified', true)
  ]);
  return { totalReports: totalReports || 0, totalPlates: totalPlates || 0 };
}

// ── submit a new report ──
async function submitReport(payload) {
  const token = crypto.randomUUID();
  const { error } = await _supabase
    .from('reports')
    .insert([{ ...payload, verified: false, verification_token: token }]);
  if (error) { console.error('submitReport:', error); throw error; }
  return { token };
}

// ── verify a report via token ──
async function verifyReport(token) {
  const { data, error } = await _supabase
    .from('reports')
    .update({ verified: true })
    .eq('verification_token', token)
    .select()
    .single();
  if (error) { console.error('verifyReport:', error); throw error; }
  return data;
}

// ── submit a dispute ──
async function submitDispute(payload) {
  const { error } = await _supabase
    .from('disputes')
    .insert([{ ...payload, status: 'pending' }]);
  if (error) { console.error('submitDispute:', error); throw error; }
}

// ── log a plate search (anonymous analytics) ──
async function logSearch(plateNumber) {
  await _supabase.from('plate_searches').insert([{ plate_number: plateNumber.toUpperCase().trim() }]);
}

// ── severity score helper ──
function calcRiskScore(reports) {
  if (!reports.length) return { label: 'None', score: 0, cls: '' };
  const sevMap = { high: 3, medium: 2, low: 1 };
  const raw = reports.reduce((acc, r) => acc + (sevMap[r.severity] || 1), 0);
  const score = Math.min(Math.round((raw / (reports.length * 3)) * 100), 100);
  if (score >= 66) return { label: 'High Risk', score, cls: 'risk-high' };
  if (score >= 33) return { label: 'Moderate',  score, cls: 'risk-med'  };
  return               { label: 'Low Risk',   score, cls: 'risk-low'  };
}

// ── tag CSS class helper ──
function tagClass(tag) {
  const map = {
    'Road Rage':'rage','Speeding':'speed','Excessive Speeding':'speed',
    'One-Way Driving':'oneway','Drunk / Impaired':'drunk',
    'Drunk Driving':'drunk','Hit and Run':'hitrun','Hit & Run':'hitrun',
    'Ignoring Signals':'signal','Harassment / Threats':'rage',
    'Reckless Driving':'speed','Other':'other'
  };
  return map[tag] || 'other';
}

// ── format relative time ──
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
}

// ── parse incident_types (handles both array and comma string) ──
function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return raw.split(',').map(t => t.trim()); }
}
