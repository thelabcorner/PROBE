import { useState, useCallback, useRef, useEffect } from 'react';
import { parseProfilingData, type RootData } from './lib/parser';
import { fmtMs, dColor } from './lib/utils';
import { OverviewTab }      from './components/OverviewTab';
import { ComponentsTab }    from './components/ComponentsTab';
import { CommitsTab }        from './components/CommitsTab';
import { OptimizationsTab } from './components/OptimizationsTab';
import { FiberTreeTab }     from './components/FiberTreeTab';
import { Badge }            from './components/Primitives';
import { ThemeProvider, useTheme } from './theme';
import {
  Activity, Upload, AlertTriangle, RefreshCw,
  BarChart2, Box, GitBranch, Zap, GitMerge,
  Sun, Moon, Shield, Search, Clock,
} from 'lucide-react';

// ─── Theme Toggle Button ──────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        padding: '5px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-base)',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget).style.color = 'var(--text-primary)';
        (e.currentTarget).style.borderColor = 'var(--border-base)';
      }}
      onMouseLeave={e => {
        (e.currentTarget).style.color = 'var(--text-tertiary)';
        (e.currentTarget).style.borderColor = 'var(--border-base)';
      }}
    >
      {theme === 'dark'
        ? <Sun  size={13} />
        : <Moon size={13} />}
    </button>
  );
}

// ─── Upload Screen ────────────────────────────────────────────────────────────

function UploadScreen({ onData }: { onData: (roots: RootData[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  const handle = useCallback((file: File | null) => {
    if (!file) return;
    setLoading(true); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = parseProfilingData(e.target?.result as string);
        onData(data);
      } catch (err: any) {
        setError(err.message || 'Parse error');
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, [onData]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0] || null);
  }, [handle]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Theme toggle fixed top-right */}
      <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 100 }}>
        <ThemeToggle />
      </div>

      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Glow */}
      <div style={{
        position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: theme === 'dark'
          ? 'radial-gradient(ellipse, rgba(99,217,255,0.07) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(2,132,199,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-10vh', right: '10%',
        width: 400, height: 200,
        background: theme === 'dark'
          ? 'radial-gradient(ellipse, rgba(192,132,252,0.04) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(124,58,237,0.03) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="anim-fade-up" style={{ width: 480, position: 'relative', zIndex: 1 }}>

        {/* Logo / branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, #0e7490 100%)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 28px var(--logo-glow)`,
            }}>
              <Activity size={22} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{
                fontFamily: "'Oxanium', sans-serif",
                fontSize: 28, fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>PROBE</div>
              <div style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
                React Profiling Inspector
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
            Drop a <span style={{ color: 'var(--accent-cyan)' }}>profiling-data.json</span> from React DevTools
            to get a full interactive analysis — timing, wasted renders, fiber trees, and optimisation suggestions.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && inputRef.current?.click()}
          style={{
            border: dragging
              ? '1.5px solid var(--accent-cyan)'
              : '1.5px dashed var(--border-base)',
            borderRadius: 8,
            padding: '44px 32px',
            textAlign: 'center',
            cursor: loading ? 'wait' : 'pointer',
            background: dragging ? 'var(--accent-cyan-bg)' : 'var(--bg-surface)',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {dragging && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, var(--accent-cyan-bg) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />
          )}
          {loading ? (
            <>
              <RefreshCw
                size={28}
                color="var(--accent-cyan)"
                style={{ margin: '0 auto 14px', animation: 'spin 0.8s linear infinite', display: 'block' }}
              />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Parsing profiling data…</div>
            </>
          ) : (
            <>
              <Upload
                size={28}
                color={dragging ? 'var(--accent-cyan)' : 'var(--border-base)'}
                style={{ margin: '0 auto 14px', display: 'block', transition: 'color 0.2s' }}
              />
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 6 }}>
                Drop <span style={{ color: 'var(--accent-cyan)' }}>profiling-data.json</span> here
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-ghost)' }}>or click to browse files</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => handle(e.target.files?.[0] || null)}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 10, padding: '10px 14px',
            background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-border)',
            borderRadius: 4, color: 'var(--accent-red)', fontSize: 11,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Feature grid */}
        <div style={{
          marginTop: 14,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
          background: 'var(--border-faint)',
          borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border-faint)',
        }}>
          {[
            [Clock,     'Timing Analysis',  'Scatter, histogram, p95/p99'],
            [Zap,       'Wasted Renders',   'Detection + suggestions'],
            [GitMerge,  'Fiber Tree',       'Full parent→child traversal'],
            [BarChart2, 'Commit Timeline',  'Per-commit flame breakdown'],
            [Search,    'Fuzzy Search',     'Across all components'],
            [Shield,    'Client-only',      'Zero data leaves your browser'],
          ].map(([Icon, title, sub]: any) => (
            <div key={String(title)} style={{ background: 'var(--bg-surface)', padding: '10px 14px' }}>
              <div style={{ marginBottom: 5 }}>
                <Icon size={12} color="var(--accent-cyan)" />
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent-cyan)', marginBottom: 2, letterSpacing: '0.04em' }}>{title}</div>
              <div style={{ fontSize: 9, color: 'var(--text-ghost)', letterSpacing: '0.02em' }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, color: 'var(--text-whisper)', letterSpacing: '0.08em' }}>
          SUPPORTS REACT DEVTOOLS V5 FORMAT · UNIVERSAL REACT APP PROFILING
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'components' | 'commits' | 'optimizations' | 'tree';

const TABS: Array<{ id: TabId; label: string; Icon: any }> = [
  { id: 'overview',       label: 'Overview',       Icon: BarChart2  },
  { id: 'components',     label: 'Components',     Icon: Box        },
  { id: 'commits',        label: 'Commits',        Icon: GitBranch  },
  { id: 'optimizations',  label: 'Optimizations',  Icon: Zap        },
  { id: 'tree',           label: 'Fiber Tree',      Icon: GitMerge   },
];

function Dashboard({ roots, onReset }: { roots: RootData[]; onReset: () => void }) {
  const [rootIdx, setRootIdx] = useState(0);
  const [tab, setTab]         = useState<TabId>('overview');
  const root = roots[rootIdx];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--header-border)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12, height: 48,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, var(--accent-cyan), #0e7490)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 12px var(--logo-glow)`,
          }}>
            <Activity size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{
            fontFamily: "'Oxanium', sans-serif",
            fontSize: 15, fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>PROBE</span>
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border-base)' }} />

        {/* Root selector */}
        {roots.length > 1 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {roots.map((r, i) => (
              <button key={i} onClick={() => setRootIdx(i)} style={{
                padding: '2px 9px', borderRadius: 3, cursor: 'pointer',
                background: rootIdx === i ? 'var(--accent-cyan-bg)' : 'transparent',
                border: `1px solid ${rootIdx === i ? 'var(--accent-cyan-border)' : 'var(--border-base)'}`,
                color: rootIdx === i ? 'var(--accent-cyan)' : 'var(--text-faint)',
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s',
              }}>{r.displayName || `Root ${i + 1}`}</button>
            ))}
          </div>
        )}

        {/* Stats pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-faint)' }}>
          <span style={{ color: 'var(--header-stat)' }}>{root.displayName}</span>
          <span style={{ color: 'var(--header-dot)' }}>·</span>
          <span>{root.commits.length} commits</span>
          <span style={{ color: 'var(--header-dot)' }}>·</span>
          <span>{root.components.length} components</span>
          <span style={{ color: 'var(--header-dot)' }}>·</span>
          <span style={{ color: dColor(root.avgDuration) }}>{fmtMs(root.avgDuration)} avg</span>
          {root.totalWasted > 0 && (
            <>
              <span style={{ color: 'var(--header-dot)' }}>·</span>
              <Badge color="var(--accent-orange)">{root.totalWasted} wasted</Badge>
            </>
          )}
          {root.slowCommits > 0 && (
            <>
              <span style={{ color: 'var(--header-dot)' }}>·</span>
              <Badge color="var(--accent-red)">{root.slowCommits} slow</Badge>
            </>
          )}
        </div>

        {/* Right actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <ThemeToggle />
          <button
            onClick={onReset}
            style={{
              padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-base)',
              color: 'var(--text-faint)', fontSize: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s', fontFamily: "'JetBrains Mono', monospace",
            }}
            onMouseEnter={e => { (e.currentTarget).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text-faint)'; }}
          >
            <Upload size={10} />
            Load New File
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        position: 'sticky', top: 48, zIndex: 49,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--header-border)',
        padding: '0 20px',
        display: 'flex', alignItems: 'flex-end', gap: 0,
      }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = tab === id;
          const alertCount =
            id === 'optimizations' ? root.totalWasted + root.slowCommits :
            id === 'commits'       ? root.slowCommits : 0;
          return (
            <button
              key={id}
              className={`probe-tab${isActive ? ' active' : ''}`}
              onClick={() => setTab(id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--tab-active-text)' : 'var(--tab-inactive-text)',
                fontSize: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.06em', textTransform: 'uppercase',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={10} />
              {label}
              {alertCount > 0 && (
                <span className="tab-badge" style={{
                  background: id === 'optimizations' ? 'var(--accent-orange-bg)' : 'var(--accent-red-bg)',
                  color:      id === 'optimizations' ? 'var(--accent-orange)'    : 'var(--accent-red)',
                  border:     `1px solid ${id === 'optimizations' ? 'var(--accent-orange-border)' : 'var(--accent-red-border)'}`,
                }}>{alertCount}</span>
              )}
            </button>
          );
        })}

        {/* Duration legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 8 }}>
          {[
            ['<1ms',   '#4b5563'],
            ['1-4ms',  '#22c55e'],
            ['4-8ms',  '#84cc16'],
            ['8-16ms', '#eab308'],
            ['16-50ms','#f97316'],
            ['>50ms',  '#ef4444'],
          ].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', flex: 1, position: 'relative', zIndex: 1 }}>
        {tab === 'overview'      && <OverviewTab      root={root} />}
        {tab === 'components'    && <ComponentsTab    root={root} />}
        {tab === 'commits'       && <CommitsTab        root={root} />}
        {tab === 'optimizations' && <OptimizationsTab root={root} />}
        {tab === 'tree'          && <FiberTreeTab     root={root} />}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const [roots, setRoots] = useState<RootData[] | null>(null);

  // Sync body bg with theme transitions
  useEffect(() => {
    document.body.style.background = '';
  }, []);

  return roots
    ? <Dashboard roots={roots} onReset={() => setRoots(null)} />
    : <UploadScreen onData={setRoots} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
