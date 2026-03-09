// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmtMs(ms: number | undefined | null): string {
  if (!ms || ms === 0) return '0ms';
  if (ms < 0.01) return '<0.01ms';
  if (ms < 10)   return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function fmtTs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s`;
}

export function pct(v: number, max: number): number {
  return max > 0 ? Math.min((v / max) * 100, 100) : 0;
}

// ─── Color scale ──────────────────────────────────────────────────────────────

export function dColor(ms: number): string {
  if (ms < 1)  return '#4b5563';
  if (ms < 4)  return '#22c55e';
  if (ms < 8)  return '#84cc16';
  if (ms < 16) return '#eab308';
  if (ms < 50) return '#f97316';
  return '#ef4444';
}

export function dColorBg(ms: number): string {
  if (ms < 1)  return 'rgba(75,85,99,0.15)';
  if (ms < 4)  return 'rgba(34,197,94,0.12)';
  if (ms < 8)  return 'rgba(132,204,22,0.12)';
  if (ms < 16) return 'rgba(234,179,8,0.12)';
  if (ms < 50) return 'rgba(249,115,22,0.12)';
  return 'rgba(239,68,68,0.12)';
}

export const PRIORITY_COLOR: Record<string, string> = {
  'Normal':          '#63d9ff',
  'User-Blocking':   '#c084fc',
  'Immediate':       '#f87171',
  'Low':             '#34d399',
  'Idle':            '#52525b',
  'Discrete':        '#fb923c',
};

export function getPriorityColor(p: string): string {
  return PRIORITY_COLOR[p] || '#52525b';
}

// ─── Fuzzy search ─────────────────────────────────────────────────────────────

export function fuzzyScore(str: string, query: string): number {
  if (!query) return 1;
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  if (s === q)          return 5;
  if (s.startsWith(q))  return 4;
  if (s.includes(q))    return 3;
  // subsequence check
  let j = 0;
  for (let i = 0; i < s.length && j < q.length; i++) {
    if (s[i] === q[j]) j++;
  }
  return j === q.length ? 2 : 0;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq   = values.map(v => (v - mean) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / values.length);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
