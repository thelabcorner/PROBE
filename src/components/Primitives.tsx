import React from 'react';
import { dColor, pct } from '../lib/utils';

// ─── ProgressBar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  h?: number;
  animated?: boolean;
  glow?: boolean;
}

export function ProgressBar({ value, max, color = 'var(--accent-cyan)', h = 4, animated = true, glow = false }: ProgressBarProps) {
  const w = pct(value, max);
  return (
    <div style={{ width: '100%', height: h, background: 'var(--bar-track)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
      <div
        className={animated ? 'bar-animated' : ''}
        style={{
          width: `${w}%`,
          height: '100%',
          background: glow ? `linear-gradient(90deg, ${color}88, ${color})` : color,
          borderRadius: 2,
          transition: 'width 0.55s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: glow ? `0 0 6px ${color}60` : undefined,
        }}
      />
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  size?: 'xs' | 'sm';
}

export function Badge({ children, color = 'var(--accent-cyan)', size = 'xs' }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'xs' ? '1px 6px' : '2px 8px',
      borderRadius: 2,
      background: `${color}18`,
      border: `1px solid ${color}35`,
      color,
      fontSize: size === 'xs' ? 9 : 11,
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 500,
      letterSpacing: '0.03em',
      lineHeight: size === 'xs' ? '15px' : '18px',
      whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </span>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
}

export function Sparkline({ data, w = 72, h = 22, color }: SparklineProps) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--text-ghost)' }}>—</span>;
  const max = Math.max(...data, 0.001);
  const min = Math.min(...data, 0);
  const range = max - min || 0.001;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 2 - Math.max(((v - min) / range) * (h - 4), 0),
  ]);
  const d   = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const col = color || dColor(Math.max(...data));
  const uid = Math.random().toString(36).slice(2, 8);
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spkg_${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.35} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spkg_${uid})`} />
      <path d={d} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={col} />
    </svg>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }>;
  accent?: string;
  delay?: number;
  alert?: boolean;
  onClick?: () => void;
}

export function KpiCard({ label, value, sub, icon: Icon, accent = 'var(--accent-cyan)', delay = 0, alert = false, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className="anim-fade-up"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${alert ? accent + '50' : 'var(--border-base)'}`,
        borderRadius: 6,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        animationDelay: `${delay}s`,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 100% 0%, ${accent}10 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />
      {alert && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{
          fontSize: 9,
          color: 'var(--text-faint)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>{label}</span>
        {Icon && <Icon size={11} color={accent} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{
        fontFamily: "'Oxanium', sans-serif",
        fontSize: 22,
        fontWeight: 700,
        color: alert ? accent : 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        position: 'relative',
      }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 10,
          color: 'var(--text-faint)',
          fontFamily: "'JetBrains Mono', monospace",
          position: 'relative',
        }}>{sub}</div>
      )}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9,
      color: 'var(--text-faint)',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontFamily: "'JetBrains Mono', monospace",
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-base), transparent)' }} />
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-base)',
      borderRadius: 6,
      padding: '14px 18px',
      boxShadow: 'var(--shadow-card)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── SearchInput ──────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={12} height={12}
        viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth={2}
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-base)',
          color: 'var(--text-primary)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          padding: '7px 30px 7px 30px',
          borderRadius: 4,
          transition: 'border-color 0.15s',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Mono text helper ─────────────────────────────────────────────────────────

export function Mono({ children, color, size = 11 }: { children: React.ReactNode; color?: string; size?: number }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: size,
      color: color || 'var(--text-tertiary)',
    }}>
      {children}
    </span>
  );
}
