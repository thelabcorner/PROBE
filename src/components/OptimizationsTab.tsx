import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ProgressBar, Badge, Panel, SectionHeader } from './Primitives';
import { fmtMs } from '../lib/utils';
import type { RootData } from '../lib/parser';
import { AlertTriangle, Zap, CheckCircle, TrendingDown, Info } from 'lucide-react';

interface Props { root: RootData; }

interface Suggestion {
  component: string;
  type: 'memo' | 'callback' | 'context' | 'split' | 'virtualize';
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  impact: string;
  fix: string;
  metric: string;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLOR_MAP: Record<string, string> = {
  critical: 'var(--accent-red)',
  high:     'var(--accent-orange)',
  medium:   'var(--accent-amber)',
  low:      'var(--accent-cyan)',
};

export function OptimizationsTab({ root }: Props) {
  const wasted      = useMemo(() => root.components.filter(c => c.wastedRenders > 0).sort((a, b) => b.wastedRenders - a.wastedRenders), [root]);
  const hotUpdaters = useMemo(() => Object.entries(root.updaterCounts).sort((a, b) => b[1] - a[1]).slice(0, 10), [root]);
  const maxUpd      = hotUpdaters[0]?.[1] || 1;
  const maxWasted   = wasted[0]?.wastedRenders || 1;

  const suggestions = useMemo((): Suggestion[] => {
    const sug: Suggestion[] = [];

    for (const c of root.components) {
      if (c.wastedRenders > 0) {
        const wasteRatio = c.wastedRenders / c.renders;
        const wastedTime = c.totalSelf * wasteRatio;
        const priority = wasteRatio > 0.8 ? 'critical' : wasteRatio > 0.5 ? 'high' : wasteRatio > 0.2 ? 'medium' : 'low';
        sug.push({
          component: c.name,
          type: 'memo',
          priority,
          reason: `Re-renders with no prop, state, hooks, or context change`,
          impact: `${c.wastedRenders} wasted renders = ~${fmtMs(wastedTime)} recoverable`,
          fix: `Wrap <${c.name}> in React.memo() and audit parent re-render causes`,
          metric: `${(wasteRatio * 100).toFixed(0)}% wasted`,
        });
      }

      if (c.contextChanges > c.renders * 0.5 && c.renders > 3) {
        sug.push({
          component: c.name,
          type: 'context',
          priority: 'medium',
          reason: `Triggers context re-renders frequently (${c.contextChanges}/${c.renders} renders)`,
          impact: `Context subscriptions force renders even with stable data`,
          fix: `Split context into smaller atoms, or use useMemo to stabilize context value`,
          metric: `${c.contextChanges} ctx renders`,
        });
      }

      if (c.renders > 50 && c.avgSelf > 4) {
        sug.push({
          component: c.name,
          type: 'virtualize',
          priority: c.renders > 200 ? 'high' : 'medium',
          reason: `Renders ${c.renders}× with avg ${fmtMs(c.avgSelf)} — high frequency expensive renders`,
          impact: `Total self time: ${fmtMs(c.totalSelf)} — significant CPU budget`,
          fix: `Audit render triggers — consider useCallback/useMemo for props passed to this component`,
          metric: `${c.renders} renders`,
        });
      }

      if (c.propsChanges > c.renders * 0.7 && c.renders > 5 && c.avgSelf > 2) {
        sug.push({
          component: c.name,
          type: 'callback',
          priority: 'medium',
          reason: `Props change in ${c.propsChanges}/${c.renders} renders — likely unstable references`,
          impact: `Prevents React.memo() from being effective, cascades child renders`,
          fix: `Wrap handler props in useCallback(), memoize object props with useMemo()`,
          metric: `${c.propsChanges} prop updates`,
        });
      }
    }

    for (const [name, count] of hotUpdaters.slice(0, 3)) {
      if (count > root.commits.length * 0.5) {
        sug.push({
          component: name,
          type: 'split',
          priority: 'medium',
          reason: `Triggers ${count}/${root.commits.length} commits — likely a top-level state updater`,
          impact: `Every update ripples to all subscribers — could trigger unnecessary subtrees`,
          fix: `Move state closer to consumers, or split into multiple isolated state slices`,
          metric: `${count} commits triggered`,
        });
      }
    }

    return sug.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [root, wasted, hotUpdaters]);

  const wastedOpts = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: 'var(--chart-label)', fontSize: 8, fontFamily: 'JetBrains Mono' },
      splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: wasted.slice(0, 10).map(c => c.name.length > 22 ? c.name.slice(0, 22) + '…' : c.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'JetBrains Mono' },
      inverse: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'var(--chart-tooltip-bg)',
      borderColor: 'var(--chart-border)',
      borderWidth: 1,
      textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 10, fontFamily: 'JetBrains Mono' },
      formatter: (p: any) => {
        const c = wasted[p[0]?.dataIndex];
        if (!c) return '';
        return `<span style="font-family:'JetBrains Mono'"><b style="color:var(--accent-orange)">${c.name}</b><br/>${c.wastedRenders} wasted / ${c.renders} total (${((c.wastedRenders / c.renders) * 100).toFixed(0)}%)</span>`;
      },
    },
    series: [{
      type: 'bar',
      data: wasted.slice(0, 10).map(c => ({
        value: c.wastedRenders,
        itemStyle: {
          color: c.wastedRenders / c.renders > 0.7 ? '#ef4444'
               : c.wastedRenders / c.renders > 0.4 ? '#f97316'
               : '#fbbf24',
          borderRadius: [0, 3, 3, 0],
        },
      })),
      barMaxWidth: 18,
    }],
    animation: true,
  }), [wasted]);

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    memo:       <Zap size={12} color="var(--accent-amber)" />,
    callback:   <TrendingDown size={12} color="var(--accent-cyan)" />,
    context:    <Info size={12} color="var(--accent-purple)" />,
    split:      <AlertTriangle size={12} color="var(--accent-orange)" />,
    virtualize: <Zap size={12} color="var(--accent-red)" />,
  };

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Status banner */}
      <div style={{
        background: root.totalWasted > 0 ? 'var(--accent-orange-bg)' : 'var(--accent-green-bg)',
        border: `1px solid ${root.totalWasted > 0 ? 'var(--accent-orange-border)' : 'var(--accent-green-border)'}`,
        borderRadius: 6, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {root.totalWasted > 0
          ? <AlertTriangle size={18} color="var(--accent-orange)" />
          : <CheckCircle size={18} color="var(--accent-green)" />}
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
            {root.totalWasted > 0
              ? `${root.totalWasted} wasted renders detected across ${wasted.length} component${wasted.length !== 1 ? 's' : ''}`
              : 'No wasted renders detected — all renders have identifiable causes'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
            {root.totalWasted > 0
              ? `Potential savings: ~${fmtMs(wasted.reduce((s, c) => s + (c.totalSelf * c.wastedRenders / c.renders), 0))} recoverable render time`
              : 'Components consistently re-render with valid causes'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 22, fontWeight: 700, color: root.verySlowCommits > 0 ? 'var(--accent-red)' : 'var(--text-ghost)' }}>
              {root.verySlowCommits}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>very slow (&gt;50ms)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 22, fontWeight: 700, color: root.slowCommits > 0 ? 'var(--accent-orange)' : 'var(--text-ghost)' }}>
              {root.slowCommits}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>slow (&gt;16ms)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

        {/* Suggestions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Panel>
            <SectionHeader><Zap size={10} color="var(--accent-amber)" />Actionable Suggestions ({suggestions.length})</SectionHeader>
            {suggestions.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", padding: '12px 0' }}>
                No specific suggestions — profiling data looks clean!
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {suggestions.slice(0, 12).map((s, i) => (
                <div key={i} style={{
                  background: 'var(--bg-subtle)',
                  border: `1px solid ${PRIORITY_COLOR_MAP[s.priority]}28`,
                  borderLeft: `3px solid ${PRIORITY_COLOR_MAP[s.priority]}`,
                  borderRadius: '0 4px 4px 0',
                  padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    {TYPE_ICONS[s.type]}
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>&lt;{s.component}&gt;</span>
                    <Badge color={PRIORITY_COLOR_MAP[s.priority]} size="xs">{s.priority}</Badge>
                    <Badge color="var(--text-faint)" size="xs">{s.metric}</Badge>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 3 }}>
                    {s.reason}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--accent-cyan)',
                    fontFamily: "'JetBrains Mono', monospace",
                    background: 'var(--accent-cyan-bg)',
                    border: '1px solid var(--accent-cyan-border)',
                    borderRadius: 3, padding: '4px 8px', marginTop: 6,
                    display: 'flex', gap: 6, alignItems: 'flex-start',
                  }}>
                    <TrendingDown size={10} style={{ flexShrink: 0, marginTop: 2 }} />
                    {s.fix}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--accent-orange)', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                    Impact: {s.impact}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Wasted chart */}
          {wasted.length > 0 && (
            <Panel>
              <SectionHeader><AlertTriangle size={10} color="var(--accent-orange)" />Wasted Renders by Component</SectionHeader>
              <ReactECharts option={wastedOpts} style={{ height: 200 }} notMerge />
            </Panel>
          )}

          {/* Wasted table */}
          {wasted.length > 0 && (
            <Panel>
              <SectionHeader>Wasted Breakdown</SectionHeader>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {wasted.map(c => (
                  <div key={c.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
                      }}>{c.name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {((c.wastedRenders / c.renders) * 100).toFixed(0)}% of renders
                        </span>
                        <Badge color="var(--accent-orange)" size="xs">{c.wastedRenders}×</Badge>
                      </div>
                    </div>
                    <ProgressBar value={c.wastedRenders} max={maxWasted} color="var(--accent-orange)" h={3} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Top render triggers */}
          <Panel>
            <SectionHeader><Info size={10} color="var(--accent-purple)" />Top Render Triggers</SectionHeader>
            {hotUpdaters.map(([name, count]) => (
              <div key={name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
                  }}>{name}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent-purple)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{count}×</span>
                </div>
                <ProgressBar value={count} max={maxUpd} color="var(--accent-purple)" h={3} />
              </div>
            ))}
            {hotUpdaters.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>No updater data available.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
