import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ProgressBar, Badge, SectionHeader, Sparkline, SearchInput } from './Primitives';
import { fmtMs, dColor, fuzzyScore } from '../lib/utils';
import type { RootData, ComponentStat } from '../lib/parser';
import { X, TrendingUp, Activity, Zap } from 'lucide-react';

interface Props { root: RootData; }

type SortKey = 'totalSelf' | 'totalActual' | 'renders' | 'maxSelf' | 'wastedRenders' | 'avgSelf';

function ComponentDetail({ comp, root, onClose }: { comp: ComponentStat; root: RootData; onClose: () => void }) {
  const histOpts = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 8, right: 8, bottom: 24, left: 44 },
    xAxis: {
      type: 'category',
      data: comp.history.map((_, i) => i + 1),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: 'var(--chart-label)', fontSize: 8, fontFamily: 'JetBrains Mono' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: 'var(--chart-label)', fontSize: 8, fontFamily: 'JetBrains Mono', formatter: (v: number) => `${v}ms` },
      splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'var(--chart-tooltip-bg)',
      borderColor: 'var(--chart-border)',
      borderWidth: 1,
      textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 10, fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => `<span style="font-family:'JetBrains Mono';color:${dColor(p[0].value)}">${fmtMs(p[0].value)}</span>`,
    },
    series: [{
      type: 'bar',
      data: comp.history.map(v => ({
        value: parseFloat(v.toFixed(3)),
        itemStyle: { color: dColor(v), borderRadius: [2, 2, 0, 0] },
      })),
      barMaxWidth: 12,
    }],
    animation: false,
  }), [comp]);

  const commitBreakdown = useMemo(() => {
    const rows: Array<{ idx: number; self: number; actual: number; reason: string }> = [];
    for (const c of root.commits) {
      const self   = c.fiberSelf.get(comp.id)   || 0;
      const actual = c.fiberActual.get(comp.id) || 0;
      if (!self && !actual) continue;
      const change = c.changeDesc.get(comp.id);
      let reason = '—';
      if (change) {
        if (change.isFirstMount) reason = 'mount';
        else {
          const parts: string[] = [];
          if (change.props   && change.props.length)               parts.push('props');
          if (Array.isArray(change.state) && change.state.length)  parts.push('state');
          if (change.didHooksChange)                               parts.push('hooks');
          if (change.context)                                      parts.push('ctx');
          if (!parts.length)                                       parts.push('wasted?');
          reason = parts.join(', ');
        }
      }
      rows.push({ idx: c.index, self, actual, reason });
    }
    return rows.sort((a, b) => b.self - a.self).slice(0, 20);
  }, [comp, root]);

  const maxSelf = commitBreakdown[0]?.self || 1;

  return (
    <div className="anim-slide-r" style={{
      width: 300, flexShrink: 0,
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-base)',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-panel)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: 'var(--bg-elevated)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
            wordBreak: 'break-all', lineHeight: 1.4,
          }}>&lt;{comp.name}&gt;</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            <Badge color={dColor(comp.avgSelf)}>{fmtMs(comp.avgSelf)} avg</Badge>
            {comp.wastedRenders > 0 && <Badge color="var(--accent-orange)">{comp.wastedRenders} wasted</Badge>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2 }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['Renders',       comp.renders,                         'var(--accent-cyan)'],
            ['Total Self',    fmtMs(comp.totalSelf),                dColor(comp.totalSelf)],
            ['Avg Self',      fmtMs(comp.avgSelf),                  dColor(comp.avgSelf)],
            ['Max Self',      fmtMs(comp.maxSelf),                  dColor(comp.maxSelf)],
            ['Min Self',      fmtMs(comp.minSelf),                  'var(--text-muted)'],
            ['Total Actual',  fmtMs(comp.totalActual),              'var(--text-tertiary)'],
            ['First Mounts',  comp.firstMounts,                     'var(--accent-green)'],
            ['Wasted',        comp.wastedRenders,                   comp.wastedRenders > 0 ? 'var(--accent-orange)' : 'var(--text-ghost)'],
          ].map(([label, val, color]) => (
            <div key={String(label)} style={{ background: 'var(--bg-elevated)', borderRadius: 4, padding: '7px 10px', border: '1px solid var(--border-faint)' }}>
              <div style={{ fontSize: 8, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: String(color), fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{String(val)}</div>
            </div>
          ))}
        </div>

        {/* Change causes */}
        <div>
          <SectionHeader>Change Causes</SectionHeader>
          {[
            ['Props',   comp.propsChanges,   'var(--accent-cyan)'],
            ['State',   comp.stateChanges,   'var(--accent-purple)'],
            ['Hooks',   comp.hooksChanges,   'var(--accent-green)'],
            ['Context', comp.contextChanges, 'var(--accent-amber)'],
          ].map(([l, v, c]) => (
            <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>{l}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 60 }}>
                  <ProgressBar value={Number(v)} max={comp.renders || 1} color={String(c)} h={2} />
                </div>
                <span style={{ fontSize: 11, color: Number(v) > 0 ? String(c) : 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", width: 24, textAlign: 'right' }}>{String(v)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Self time history */}
        {comp.history.length > 1 && (
          <div>
            <SectionHeader><TrendingUp size={9} color="var(--accent-cyan)" />Self Time per Render</SectionHeader>
            <ReactECharts option={histOpts} style={{ height: 80 }} notMerge />
          </div>
        )}

        {comp.parentNames.size > 0 && (
          <div>
            <SectionHeader>Parent Components</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[...comp.parentNames].slice(0, 5).map(n => (
                <span key={n} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>↑ {n}</span>
              ))}
            </div>
          </div>
        )}
        {comp.childNames.size > 0 && (
          <div>
            <SectionHeader>Child Components</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[...comp.childNames].slice(0, 5).map(n => (
                <span key={n} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>↓ {n}</span>
              ))}
            </div>
          </div>
        )}

        {/* Top commits for this component */}
        <div>
          <SectionHeader><Activity size={9} color="var(--accent-purple)" />Slowest Commits (self)</SectionHeader>
          {commitBreakdown.slice(0, 8).map(r => (
            <div key={r.idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", width: 24, flexShrink: 0 }}>#{r.idx}</span>
              <div style={{ flex: 1 }}>
                <ProgressBar value={r.self} max={maxSelf} color={dColor(r.self)} h={3} />
              </div>
              <span style={{ fontSize: 10, color: dColor(r.self), fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, width: 48, textAlign: 'right' }}>{fmtMs(r.self)}</span>
              <Badge color={r.reason === 'wasted?' ? 'var(--accent-orange)' : r.reason === 'mount' ? 'var(--accent-green)' : 'var(--accent-purple)'}>{r.reason}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ComponentsTab({ root }: Props) {
  const [query,    setQuery]    = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('totalSelf');
  const [sortDir,  setSortDir]  = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const [showWasted, setShowWasted] = useState(false);

  const sorted = useMemo(() => {
    let list = showWasted ? root.components.filter(c => c.wastedRenders > 0) : root.components;
    if (query) {
      list = list
        .map(c => ({ ...c, _s: fuzzyScore(c.name, query) }))
        .filter((c: any) => c._s > 0)
        .sort((a: any, b: any) => b._s - a._s);
    } else {
      list = [...list].sort((a, b) => sortDir * (b[sortKey] - a[sortKey]));
    }
    return list;
  }, [root.components, query, sortKey, sortDir, showWasted]);

  const sel     = selected ? root.components.find(c => c.name === selected) || null : null;
  const maxSelf = root.components[0]?.totalSelf || 1;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === -1 ? 1 : -1) as 1 | -1);
    else { setSortKey(k); setSortDir(-1); }
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="sortable"
      onClick={() => toggleSort(k)}
      style={{
        padding: '8px 12px', textAlign: 'right', fontSize: 9,
        color: sortKey === k ? 'var(--accent-cyan)' : 'var(--text-ghost)',
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em',
        textTransform: 'uppercase', whiteSpace: 'nowrap', userSelect: 'none',
        transition: 'color 0.15s', cursor: 'pointer',
      }}
    >
      {label}{sortKey === k ? (sortDir < 0 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div className="anim-fade-in" style={{ display: 'flex', gap: 10, height: 'calc(100vh - 130px)', minHeight: 500 }}>
      {/* Main table */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Fuzzy search components…" />
          </div>
          <button
            onClick={() => setShowWasted(v => !v)}
            style={{
              padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              background: showWasted ? 'var(--accent-orange-bg)' : 'var(--bg-surface)',
              border: `1px solid ${showWasted ? 'var(--accent-orange-border)' : 'var(--border-base)'}`,
              color: showWasted ? 'var(--accent-orange)' : 'var(--text-faint)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Zap size={10} />
            Wasted only
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
            {sorted.length} / {root.components.length}
          </span>
        </div>

        {/* Table */}
        <div style={{
          flex: 1, overflow: 'auto',
          border: '1px solid var(--border-base)', borderRadius: 6,
          background: 'var(--bg-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)',
                position: 'sticky', top: 0, zIndex: 2,
              }}>
                <th style={{
                  padding: '8px 12px', textAlign: 'left', fontSize: 9,
                  color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>Component</th>
                <Th k="renders"       label="Renders" />
                <Th k="totalSelf"     label="Self ∑" />
                <Th k="avgSelf"       label="Avg Self" />
                <Th k="maxSelf"       label="Max Self" />
                <Th k="totalActual"   label="Actual ∑" />
                <Th k="wastedRenders" label="Wasted" />
                <th style={{
                  padding: '8px 12px', textAlign: 'right', fontSize: 9,
                  color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr
                  key={c.name}
                  className={`probe-row${selected === c.name ? ' sel' : ''}`}
                  onClick={() => setSelected(s => s === c.name ? null : c.name)}
                  style={{
                    borderBottom: '1px solid var(--border-muted)',
                    borderLeft: '2px solid transparent',
                  }}
                >
                  <td style={{ padding: '7px 12px', maxWidth: 220 }}>
                    <div style={{
                      fontSize: 12, color: selected === c.name ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                    }}>{c.name}</div>
                    <div style={{ marginTop: 3 }}>
                      <ProgressBar value={c.totalSelf} max={maxSelf} color={dColor(c.avgSelf)} h={2} animated={false} />
                    </div>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11, color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono', monospace" }}>{c.renders}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11, color: dColor(c.totalSelf), fontFamily: "'JetBrains Mono', monospace" }}>{fmtMs(c.totalSelf)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11, color: dColor(c.avgSelf), fontFamily: "'JetBrains Mono', monospace" }}>{fmtMs(c.avgSelf)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11, color: dColor(c.maxSelf), fontFamily: "'JetBrains Mono', monospace" }}>{fmtMs(c.maxSelf)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>{fmtMs(c.totalActual)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    {c.wastedRenders > 0
                      ? <Badge color="var(--accent-orange)">{c.wastedRenders}</Badge>
                      : <span style={{ fontSize: 9, color: 'var(--text-whisper)' }}>—</span>}
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    <Sparkline data={c.history.slice(-24)} w={60} h={18} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>
                    No components match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {sel && (
        <ComponentDetail comp={sel} root={root} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
