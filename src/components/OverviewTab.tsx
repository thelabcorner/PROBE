import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { KpiCard, ProgressBar, Badge, Panel, SectionHeader, Sparkline } from './Primitives';
import { fmtMs, fmtTs, dColor, getPriorityColor } from '../lib/utils';
import type { RootData } from '../lib/parser';
import {
  GitBranch, Clock, TrendingUp, Box, AlertTriangle,
  Zap, Activity, BarChart2, Flame,
} from 'lucide-react';

interface Props { root: RootData; }

export function OverviewTab({ root }: Props) {
  // Timeline chart options
  const timelineOpts = useMemo(() => {
    const commits = root.commits;
    const data = commits.map(c => ({
      value: [c.index, parseFloat(c.duration.toFixed(3))],
      itemStyle: { color: dColor(c.duration) },
    }));

    return {
      backgroundColor: 'transparent',
      grid: { top: 16, right: 16, bottom: 28, left: 52 },
      xAxis: {
        type: 'value',
        min: 0,
        max: commits.length - 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'var(--chart-label)', fontSize: 9, fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
        name: 'commit index',
        nameLocation: 'end',
        nameTextStyle: { color: 'var(--text-ghost)', fontSize: 8, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'var(--chart-label)', fontSize: 9, fontFamily: 'JetBrains Mono',
          formatter: (v: number) => `${v}ms`,
        },
        splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'var(--chart-tooltip-bg)',
        borderColor: 'var(--chart-border)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 11, fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const idx = params.value[0];
          const dur = params.value[1];
          const c   = root.commits[idx];
          if (!c) return '';
          const col = dColor(dur);
          return `
            <div style="font-family:'JetBrains Mono',monospace;line-height:1.8">
              <div style="color:var(--text-faint);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">COMMIT #${idx}</div>
              <div style="color:${col};font-size:14px;font-weight:600">${fmtMs(dur)}</div>
              <div style="color:var(--text-faint);font-size:10px;margin-top:4px">${fmtTs(c.timestamp)}</div>
              <div style="color:var(--text-muted);font-size:10px">${c.priorityLevel}</div>
              ${c.updaters.length ? `<div style="color:var(--accent-cyan);font-size:10px;margin-top:2px">↑ ${c.updaters.slice(0, 2).join(', ')}</div>` : ''}
              <div style="color:#ef444488;font-size:9px;margin-top:4px;border-top:1px solid var(--border-base);padding-top:4px">
                Effects: ${fmtMs(c.effectDuration)} · Passive: ${fmtMs(c.passiveEffectDuration)}
              </div>
            </div>`;
        },
      },
      series: [{
        type: 'scatter',
        data,
        symbolSize: (val: number[]) => {
          const ms = val[1];
          return ms > 50 ? 8 : ms > 16 ? 6 : 4;
        },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: '#ef444438', type: 'dashed', width: 1 },
          label: {
            show: true,
            color: '#ef444488',
            fontSize: 9,
            fontFamily: 'JetBrains Mono',
            formatter: '16ms',
            position: 'insideEndTop',
          },
          data: [{ yAxis: 16 }],
        },
        emphasis: { scale: 1.5 },
      }],
      animation: true,
      animationDuration: 400,
    };
  }, [root]);

  // Duration histogram
  const histOpts = useMemo(() => {
    const labels = ['<1ms', '1-4', '4-8', '8-16', '16-50', '50+'];
    const colors = ['#4b5563', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
    return {
      backgroundColor: 'transparent',
      grid: { top: 12, right: 12, bottom: 30, left: 36 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'var(--chart-label)', fontSize: 9, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: 'var(--chart-label)', fontSize: 9, fontFamily: 'JetBrains Mono' },
        splitLine: { lineStyle: { color: 'var(--chart-split)', type: 'dashed' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--chart-tooltip-bg)',
        borderColor: 'var(--chart-border)',
        borderWidth: 1,
        textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 11, fontFamily: 'JetBrains Mono' },
        formatter: (params: any) => {
          const p = params[0];
          return `<span style="font-family:'JetBrains Mono',monospace"><span style="color:${colors[p.dataIndex]}">${p.name}</span>: ${p.value} commits</span>`;
        },
      },
      series: [{
        type: 'bar',
        data: root.durationBuckets.map((v, i) => ({
          value: v,
          itemStyle: {
            color: colors[i],
            opacity: 0.85,
            borderRadius: [2, 2, 0, 0],
          },
        })),
        barMaxWidth: 32,
      }],
      animation: true,
      animationDuration: 500,
    };
  }, [root]);

  // Priority donut
  const priorityOpts = useMemo(() => {
    const entries = Object.entries(root.priorityCounts);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'var(--chart-tooltip-bg)',
        borderColor: 'var(--chart-border)',
        borderWidth: 1,
        textStyle: { color: 'var(--chart-tooltip-fg)', fontSize: 11, fontFamily: 'JetBrains Mono' },
        formatter: (p: any) => `<span style="font-family:'JetBrains Mono',monospace"><span style="color:${p.color}">${p.name}</span>: ${p.value}</span>`,
      },
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '50%'],
        data: entries.map(([name, value]) => ({
          name, value,
          itemStyle: { color: getPriorityColor(name) },
          label: { show: false },
        })),
        emphasis: { scale: false, itemStyle: { shadowBlur: 8, shadowColor: 'rgba(99,217,255,0.3)' } },
      }],
      animation: true,
    };
  }, [root]);

  const topSelf    = root.components.slice(0, 8);
  const topRenders = useMemo(() => [...root.components].sort((a, b) => b.renders - a.renders).slice(0, 6), [root.components]);
  const maxSelf    = topSelf[0]?.totalSelf || 1;
  const maxRenders = topRenders[0]?.renders || 1;
  const wastedTop  = useMemo(() => root.components.filter(c => c.wastedRenders > 0).sort((a, b) => b.wastedRenders - a.wastedRenders).slice(0, 5), [root.components]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return root.commits.map(c => { cum += c.duration; return parseFloat(cum.toFixed(2)); });
  }, [root]);

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        <KpiCard label="Commits"        value={root.commits.length}     sub={`${root.slowCommits} > 16ms`}         icon={GitBranch}    accent="var(--accent-cyan)"   delay={0}    />
        <KpiCard label="Avg Duration"   value={fmtMs(root.avgDuration)} sub={`med ${fmtMs(root.medianDuration)}`}  icon={Clock}        accent="var(--accent-purple)" delay={0.04} />
        <KpiCard label="P95"            value={fmtMs(root.p95)}         sub={`p99 ${fmtMs(root.p99)}`}             icon={TrendingUp}   accent="var(--accent-amber)"  delay={0.08} />
        <KpiCard label="Components"     value={root.components.length}  sub="tracked unique"                       icon={Box}          accent="var(--accent-green)"  delay={0.12} />
        <KpiCard label="Wasted Renders" value={root.totalWasted}        sub="avoidable re-renders"                 icon={Zap}          accent="var(--accent-orange)" delay={0.16} alert={root.totalWasted > 0} />
        <KpiCard label="Slow (>16ms)"   value={root.slowCommits}        sub={`${root.verySlowCommits} very slow`}  icon={AlertTriangle} accent="var(--accent-red)"   delay={0.20} alert={root.slowCommits > 0} />
      </div>

      {/* Timeline + Histogram */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 8 }}>
        <Panel>
          <SectionHeader>
            <Activity size={10} color="var(--accent-cyan)" />
            Commit Timeline — duration scatter
          </SectionHeader>
          <ReactECharts option={timelineOpts} style={{ height: 150 }} notMerge />
        </Panel>
        <Panel>
          <SectionHeader>
            <BarChart2 size={10} color="var(--accent-purple)" />
            Duration Distribution
          </SectionHeader>
          <ReactECharts option={histOpts} style={{ height: 150 }} notMerge />
        </Panel>
      </div>

      {/* Three columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: 8 }}>

        {/* Slowest components */}
        <Panel>
          <SectionHeader>
            <Flame size={10} color="var(--accent-orange)" />
            Slowest — Total Self Time
          </SectionHeader>
          {topSelf.map((c, i) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace",
                width: 14, textAlign: 'right', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{
                flex: 1, fontSize: 11, color: 'var(--text-tertiary)',
                fontFamily: "'JetBrains Mono', monospace",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{c.name}</span>
              <Sparkline data={c.history.slice(-20)} w={40} h={16} />
              <div style={{ width: 64, flexShrink: 0 }}>
                <ProgressBar value={c.totalSelf} max={maxSelf} color={dColor(c.avgSelf)} h={3} />
              </div>
              <span style={{
                fontSize: 10, color: dColor(c.avgSelf), fontFamily: "'JetBrains Mono', monospace",
                flexShrink: 0, width: 56, textAlign: 'right',
              }}>{fmtMs(c.totalSelf)}</span>
            </div>
          ))}
        </Panel>

        {/* Most rendered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Panel style={{ flex: 1 }}>
            <SectionHeader>
              <BarChart2 size={10} color="var(--accent-cyan)" />
              Most Rendered
            </SectionHeader>
            {topRenders.map(c => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{
                  flex: 1, fontSize: 11, color: 'var(--text-tertiary)',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.name}</span>
                <div style={{ width: 60, flexShrink: 0 }}>
                  <ProgressBar value={c.renders} max={maxRenders} color="var(--accent-cyan)" h={3} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, width: 36, textAlign: 'right' }}>
                  {c.renders}×
                </span>
              </div>
            ))}
          </Panel>

          {wastedTop.length > 0 && (
            <Panel>
              <SectionHeader>
                <AlertTriangle size={10} color="var(--accent-orange)" />
                Top Wasted Renders
              </SectionHeader>
              {wastedTop.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{
                    flex: 1, fontSize: 10, color: 'var(--text-tertiary)',
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.name}</span>
                  <Badge color="var(--accent-orange)">{c.wastedRenders}×</Badge>
                </div>
              ))}
            </Panel>
          )}
        </div>

        {/* Priority + cumulative sparkline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Panel>
            <SectionHeader>Priority</SectionHeader>
            <div style={{ height: 100 }}>
              <ReactECharts option={priorityOpts} style={{ height: 100 }} notMerge />
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(root.priorityCounts).map(([name, val]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: getPriorityColor(name), flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: getPriorityColor(name), fontFamily: "'JetBrains Mono', monospace" }}>{val}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader>Cumulative Time</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {fmtMs(root.totalDuration)}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>total render time</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Sparkline data={cumulativeData} w={164} h={32} color="var(--accent-cyan)" />
            </div>
          </Panel>
        </div>
      </div>

    </div>
  );
}
