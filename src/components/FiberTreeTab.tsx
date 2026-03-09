import { useState, useMemo } from 'react';
import { Badge, SearchInput, SectionHeader } from './Primitives';
import { fmtMs, dColor, fuzzyScore } from '../lib/utils';
import type { RootData } from '../lib/parser';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Props { root: RootData; }

interface TreeNode {
  id: number;
  name: string | null;
  children: TreeNode[];
  depth: number;
  totalRenders: number;
  totalSelf: number;
  maxSelf: number;
}

function buildTree(
  id: number,
  fiberNames: Map<number, string | null>,
  fiberChildren: Map<number, number[]>,
  compStats: Map<string, { renders: number; totalSelf: number; maxSelf: number }>,
  depth: number,
  visited: Set<number>
): TreeNode {
  if (visited.has(id)) {
    return { id, name: fiberNames.get(id) || null, children: [], depth, totalRenders: 0, totalSelf: 0, maxSelf: 0 };
  }
  visited.add(id);
  const name     = fiberNames.get(id) || null;
  const stats    = name ? compStats.get(name) : null;
  const children = (fiberChildren.get(id) || []).map(childId =>
    buildTree(childId, fiberNames, fiberChildren, compStats, depth + 1, visited)
  );
  return {
    id,
    name,
    children,
    depth,
    totalRenders: stats?.renders    || 0,
    totalSelf:    stats?.totalSelf  || 0,
    maxSelf:      stats?.maxSelf    || 0,
  };
}

function TreeNodeRow({
  node, expanded, onToggle, selected, onSelect, query, maxSelf
}: {
  node: TreeNode;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  selected: number | null;
  onSelect: (id: number) => void;
  query: string;
  maxSelf: number;
}) {
  const isExpanded  = expanded.has(node.id);
  const isSelected  = selected === node.id;
  const hasChildren = node.children.length > 0;
  const displayName = node.name || `(fiber ${node.id})`;
  const matched     = query ? fuzzyScore(displayName, query) > 0 : true;
  if (!matched && !hasChildren) return null;

  return (
    <>
      <div
        className={`probe-row${isSelected ? ' sel' : ''}`}
        onClick={() => { onSelect(node.id); if (hasChildren) onToggle(node.id); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 0,
          paddingLeft: `${node.depth * 14 + 8}px`,
          paddingRight: 12, paddingTop: 4, paddingBottom: 4,
          borderLeft: '2px solid transparent',
          borderBottom: '1px solid var(--border-muted)',
          minHeight: 28,
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {hasChildren ? (
            isExpanded
              ? <ChevronDown  size={10} color="var(--text-faint)" />
              : <ChevronRight size={10} color="var(--text-faint)" />
          ) : (
            <div style={{ width: 8, height: 1, background: 'var(--border-base)', marginLeft: 4 }} />
          )}
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: !node.name
            ? 'var(--text-ghost)'
            : matched
              ? (isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)')
              : 'var(--text-ghost)',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name ? `<${node.name}>` : `(fiber ${node.id})`}
        </span>
        {node.totalRenders > 0 && (
          <>
            <span style={{ fontSize: 9, color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono', monospace", marginRight: 8 }}>
              {node.totalRenders}×
            </span>
            <div style={{ width: 48, marginRight: 8 }}>
              <div style={{ width: '100%', height: 3, background: 'var(--bar-track)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min((node.totalSelf / maxSelf) * 100, 100)}%`,
                  height: '100%', background: dColor(node.totalSelf / node.totalRenders),
                  borderRadius: 2,
                }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: dColor(node.totalSelf / node.totalRenders), fontFamily: "'JetBrains Mono', monospace", width: 56, textAlign: 'right', flexShrink: 0 }}>
              {fmtMs(node.totalSelf)}
            </span>
          </>
        )}
        {node.children.length > 0 && (
          <Badge color="var(--text-ghost)" size="xs">{node.children.length}</Badge>
        )}
      </div>
      {isExpanded && node.children.map(child => (
        <TreeNodeRow
          key={child.id}
          node={child}
          expanded={expanded}
          onToggle={onToggle}
          selected={selected}
          onSelect={onSelect}
          query={query}
          maxSelf={maxSelf}
        />
      ))}
    </>
  );
}

export function FiberTreeTab({ root }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery]       = useState('');

  const compStats = useMemo(() => {
    const m = new Map<string, { renders: number; totalSelf: number; maxSelf: number }>();
    for (const c of root.components) m.set(c.name, { renders: c.renders, totalSelf: c.totalSelf, maxSelf: c.maxSelf });
    return m;
  }, [root.components]);

  const treeRoots = useMemo(() => {
    const visited = new Set<number>();
    return root.treeRoots.map(id => buildTree(id, root.fiberNames, root.fiberChildren, compStats, 0, visited));
  }, [root, compStats]);

  const maxSelf = root.components[0]?.totalSelf || 1;

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    const visit = (node: TreeNode) => { all.add(node.id); node.children.forEach(visit); };
    treeRoots.forEach(visit);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  const selectedName = selected !== null ? root.fiberNames.get(selected) || null : null;
  const selectedComp = selectedName ? root.components.find(c => c.name === selectedName) || null : null;
  const selectedChildren = selected !== null ? (root.fiberChildren.get(selected) || []) : [];
  const selectedParent   = selected !== null ? root.fiberParents.get(selected) : null;

  const btnStyle = {
    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
    background: 'var(--bg-surface)', border: '1px solid var(--border-base)',
    color: 'var(--text-faint)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
  } as const;

  return (
    <div className="anim-fade-in" style={{ display: 'flex', gap: 10, height: 'calc(100vh - 130px)', minHeight: 500 }}>

      {/* Tree panel */}
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--bg-subtle)', border: '1px solid var(--border-base)', borderRadius: 6,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search components in tree…" />
          </div>
          <button onClick={expandAll}   style={btnStyle}>Expand All</button>
          <button onClick={collapseAll} style={btnStyle}>Collapse</button>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '4px 12px 4px 24px',
          borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
        }}>
          <span style={{ flex: 1, fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Component</span>
          <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", marginRight: 56, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Renders</span>
          <span style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", width: 104, textAlign: 'right', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Self Time ∑</span>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {treeRoots.map(node => (
            <TreeNodeRow
              key={node.id}
              node={node}
              expanded={expanded}
              onToggle={toggleExpanded}
              selected={selected}
              onSelect={setSelected}
              query={query}
              maxSelf={maxSelf}
            />
          ))}
          {treeRoots.length === 0 && (
            <div style={{ padding: 24, fontSize: 11, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace" }}>
              No fiber tree data available in this profiling snapshot.
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{
        width: 260, flexShrink: 0,
        background: 'var(--bg-subtle)', border: '1px solid var(--border-base)', borderRadius: 6,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {selected !== null ? (
          <div style={{ padding: '14px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
                Selected Fiber
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13, fontWeight: 500, color: 'var(--accent-cyan)',
                wordBreak: 'break-all',
              }}>
                {selectedName ? `<${selectedName}>` : `(anonymous fiber ${selected})`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                ID: {selected}
              </div>
            </div>

            {selectedComp && (
              <div>
                <SectionHeader>Performance Stats</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['Renders',    selectedComp.renders,                'var(--accent-cyan)'],
                    ['Total Self', fmtMs(selectedComp.totalSelf),       dColor(selectedComp.totalSelf)],
                    ['Avg Self',   fmtMs(selectedComp.avgSelf),         dColor(selectedComp.avgSelf)],
                    ['Max Self',   fmtMs(selectedComp.maxSelf),         dColor(selectedComp.maxSelf)],
                    ['Wasted',     selectedComp.wastedRenders,          selectedComp.wastedRenders > 0 ? 'var(--accent-orange)' : 'var(--text-ghost)'],
                    ['Mounts',     selectedComp.firstMounts,            'var(--accent-green)'],
                  ].map(([label, val, color]) => (
                    <div key={String(label)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-faint)', borderRadius: 3, padding: '6px 8px' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: String(color), fontFamily: "'JetBrains Mono', monospace" }}>{String(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedParent !== null && selectedParent !== undefined && (
              <div>
                <SectionHeader>Parent</SectionHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>↑</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {root.fiberNames.get(selectedParent) || `(fiber ${selectedParent})`}
                  </span>
                </div>
              </div>
            )}

            {selectedChildren.length > 0 && (
              <div>
                <SectionHeader>Children ({selectedChildren.length})</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                  {selectedChildren.map(childId => {
                    const childName  = root.fiberNames.get(childId);
                    const childStats = childName ? root.components.find(c => c.name === childName) : null;
                    return (
                      <div key={childId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-faint)', borderRadius: 3,
                        cursor: 'pointer',
                      }} onClick={() => setSelected(childId)}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>↓ {childName || `(fiber ${childId})`}</span>
                        {childStats && (
                          <span style={{ fontSize: 9, color: dColor(childStats.avgSelf), fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmtMs(childStats.avgSelf)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!selectedComp && (
              <div style={{
                padding: '10px 12px',
                background: 'var(--accent-cyan-bg)',
                border: '1px solid var(--accent-cyan-border)',
                borderRadius: 4,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
                  This fiber has no render data — it may be a host element, context, or fragment.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
              Click a node in the tree to inspect it
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
