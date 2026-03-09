import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Badge, SectionHeader } from './Primitives';
import { fmtMs, fmtTs, dColor, getPriorityColor } from '../lib/utils';
import type { RootData } from '../lib/parser';
import { Clock, Zap, Activity, GitBranch } from 'lucide-react';

interface Props { root: RootData; }

type FilterMode = 'all' | 'slow' | 'vslow' | 'ub' | 'imm';

interface RenderedFiber {
  id: number;
  name: string;
  self: number;
  actual: number;
  reasons: string[];
}

export function CommitsTab({ root }: Props) {
  const [selIdx,  setSelIdx]  = useState(0);
  const [filter,  setFilter]  = useState<FilterMode>('all');
  const [search,  setSearch]  = useState('');

  const filtered = useMemo(() => {
    let list = root.commits;
    if (filter === 'slow')  list = list.filter(c => c.duration > 16 && c.duration <= 50);
    if (filter === 'vslow') list = list.filter(c => c.duration > 50);
    if (filter === 'ub')    list = list.filter(c => c.priorityLevel === 'User-Blocking');
    if (filter === 'imm')   list = list.filter(c => c.priorityLevel === 'Immediate');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.updaters.some(u => u.toLowerCase().includes(q)) ||
        String(c.index).includes(q)
      );
    }
    return list;
  }, [root.commits, filter, search]);

  const commit = root.commits[selIdx];

  const renderedFibers = useMemo((): RenderedFiber[] => {
    if (!commit) return [];
    const rows: RenderedFiber[] = [];
    for (const [id, actual] of commit.fiberActual) {
      const name = root.fiberNames.get(id);
      if (!name) continue;
      const self   = commit.fiberSelf.get(id) || 0;
      const change = commit.changeDesc.get(id);
      const reasons: string[] = [];
      if (change) {
        if (change.isFirstMount) {
          reasons.push('mount');
        } else {
          if (change.props && change.props.length)                reasons.push(`props: ${change.props.slice(0, 3).join(', ')}`);
          if (Array.isArray(change.state) && change.state.length) reasons.push('state');
          if (change.didHooksChange)                              reasons.push('hooks');
          if (change.context)                                     reasons.push('context');
          if (!reasons.length)                                    reasons.push('wasted?');
        }
      }
      rows.push({ id, name, actual, self, reasons });
    }
    return rows.sort((a, b) => b.self - a.self);
  }, [commit, root]);

  const maxSelf = renderedFibers[0]?.self || 1;

  const waterfallOpts = useMemo(() => {
    if (!commit || renderedFibers.length === 0) return null;
    const top10 = renderedFibers.slice(0, 12);
    return {
      backgroundColor: 'transparent',
      grid: { top: 8, right: 60, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: 'var(--chart-label)', fontSize: 8, fontFamily: 'JetBrains Mono', formatter: (v: number) => `${v}ms` },
        splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: top10.map(f => f.name.length > 20 ? f.name.slice(0, 20) + '…' : f.name),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono' },
        inverse: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--chart-tooltip-bg)',
        borderColor: 'var(--chart-border)',
        borderWidth: 1,
        textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 10, fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const f = top10[params[0]?.dataIndex];
          if (!f) return '';
          return `<div style="font-family:'JetBrains Mono';line-height:1.8">
            <b style="color:var(--text-primary)">${f.name}</b><br/>
            <span style="color:${dColor(f.self)}">self: ${fmtMs(f.self)}</span><br/>
            <span style="color:var(--text-muted)">actual: ${fmtMs(f.actual)}</span>
          </div>`;
        },
      },
      series: [
        {
          name: 'Actual',
          type: 'bar',
          data: top10.map(f => ({
            value: parseFloat(f.actual.toFixed(3)),
            itemStyle: { color: dColor(f.actual) + '30', borderRadius: [0, 2, 2, 0] },
          })),
          barMaxWidth: 12,
          z: 1,
        },
        {
          name: 'Self',
          type: 'bar',
          barGap: '-100%',
          data: top10.map(f => ({
            value: parseFloat(f.self.toFixed(3)),
            itemStyle: { color: dColor(f.self), opacity: 0.9, borderRadius: [0, 2, 2, 0] },
          })),
          barMaxWidth: 12,
          z: 2,
        },
      ],
      animation: true,
      animationDuration: 400,
    };
  }, [commit, renderedFibers]);

  const FILTERS: Array<[FilterMode, string]> = [
    ['all',   'All'],
    ['slow',  '16–50ms'],
    ['vslow', '>50ms'],
    ['ub',    'User-Block'],
    ['imm',   'Immediate'],
  ];

  return (
    <div className="anim-fade-in" style={{ display: 'flex', gap: 10, height: 'calc(100vh - 130px)', minHeight: 500 }}>

      {/* Left — commit list */}
      <div style={{
        width: 220, flexShrink: 0,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-base)',
        borderRadius: 6,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Filters */}
        <div style={{
          padding: '8px 8px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
          display: 'flex', gap: 3, flexWrap: 'wrap',
        }}>
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                background: filter === k ? 'var(--accent-cyan-bg)' : 'transparent',
                border: `1px solid ${filter === k ? 'var(--accent-cyan-border)' : 'var(--border-base)'}`,
                color: filter === k ? 'var(--accent-cyan)' : 'var(--text-faint)',
                fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s',
              }}
            >{l}</button>
          ))}
        </div>
        {/* Search */}
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter commits…"
            style={{
              width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
              color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, padding: '4px 8px', borderRadius: 3,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", padding: '4px 10px', borderBottom: '1px solid var(--border-muted)' }}>
          {filtered.length} commits
        </div>
        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(c => (
            <div
              key={c.index}
              className={`probe-row${selIdx === c.index ? ' sel' : ''}`}
              onClick={() => setSelIdx(c.index)}
              style={{
                padding: '7px 10px',
                borderBottom: '1px solid var(--border-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
                borderLeft: '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", width: 26, flexShrink: 0 }}>
                #{c.index}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: dColor(c.duration),
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                }}>{fmtMs(c.duration)}</div>
                <div style={{
                  fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{fmtTs(c.timestamp)}</div>
              </div>
              <Badge color={getPriorityColor(c.priorityLevel)} size="xs">
                {c.priorityLevel === 'User-Blocking' ? 'UB' : c.priorityLevel === 'Immediate' ? 'IM' : 'NR'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Right — commit detail */}
      {commit ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Header */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
            borderRadius: 6, padding: '14px 18px', boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: "'Oxanium', sans-serif",
                fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
              }}>Commit #{commit.index}</span>
              <Badge color={getPriorityColor(commit.priorityLevel)}>{commit.priorityLevel}</Badge>
              <span style={{
                marginLeft: 'auto', fontSize: 16,
                color: dColor(commit.duration),
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
              }}>{fmtMs(commit.duration)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                ['Timestamp',        fmtTs(commit.timestamp),             'var(--text-faint)',   Clock],
                ['Render',           fmtMs(commit.duration),              dColor(commit.duration), Activity],
                ['Effects',          fmtMs(commit.effectDuration),        'var(--accent-purple)', Zap],
                ['Passive Effects',  fmtMs(commit.passiveEffectDuration), 'var(--accent-green)',  GitBranch],
              ].map(([label, val, color, Icon]: any) => (
                <div key={String(label)} style={{
                  background: 'var(--bg-elevated)', borderRadius: 4, padding: '8px 10px',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Icon size={9} color={color} />
                    <span style={{ fontSize: 8, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 14, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>

            {commit.updaters.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Triggered by:</span>
                {commit.updaters.map(u => <Badge key={u} color="var(--accent-cyan)">{u}</Badge>)}
              </div>
            )}
          </div>

          {/* Waterfall + fiber list */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

            {waterfallOpts && (
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
                borderRadius: 6, padding: '14px 18px', display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-card)',
              }}>
                <SectionHeader><Activity size={9} color="var(--accent-cyan)" />Top Components — Self vs Actual</SectionHeader>
                <ReactECharts option={waterfallOpts} style={{ flex: 1, minHeight: 200 }} notMerge />
              </div>
            )}

            {/* Fiber list */}
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
              borderRadius: 6, padding: '14px 18px', display: 'flex', flexDirection: 'column',
              overflow: 'hidden', boxShadow: 'var(--shadow-card)',
            }}>
              <SectionHeader>
                {renderedFibers.length} components rendered
              </SectionHeader>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderedFibers.map(f => (
                  <div key={f.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      fontSize: 10, color: 'var(--text-tertiary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      width: 150, flexShrink: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f.name}</span>
                    <div style={{ flex: 1, position: 'relative', height: 12, background: 'var(--bar-track)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${(f.actual / maxSelf) * 100}%`,
                        background: dColor(f.actual), opacity: 0.2, borderRadius: 2,
                      }} />
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${(f.self / maxSelf) * 100}%`,
                        background: dColor(f.self), opacity: 0.85, borderRadius: 2,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 9, color: dColor(f.self),
                      fontFamily: "'JetBrains Mono', monospace",
                      width: 50, textAlign: 'right', flexShrink: 0,
                    }}>{fmtMs(f.self)}</span>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0, maxWidth: 140 }}>
                      {f.reasons.slice(0, 2).map(r => (
                        <Badge key={r} color={r === 'wasted?' ? 'var(--accent-orange)' : r === 'mount' ? 'var(--accent-green)' : 'var(--accent-purple)'} size="xs">
                          {r.length > 20 ? r.slice(0, 20) + '…' : r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {renderedFibers.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", padding: '20px 0' }}>
                    No named components rendered.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>Select a commit</span>
        </div>
      )}
    </div>
  );
}
