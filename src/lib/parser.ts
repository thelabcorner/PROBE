// ─── React Profiling Data Parser ─────────────────────────────────────────────

export interface CommitData {
  index: number;
  duration: number;
  timestamp: number;
  priorityLevel: string;
  effectDuration: number;
  passiveEffectDuration: number;
  updaters: string[];
  fiberActual: Map<number, number>;
  fiberSelf: Map<number, number>;
  changeDesc: Map<number, ChangeDescription>;
}

export interface ChangeDescription {
  isFirstMount: boolean;
  props: string[] | null;
  state: number[] | null;
  hooks: number[] | null;
  didHooksChange: boolean;
  context: boolean | null;
}

export interface ComponentStat {
  name: string;
  id: number;
  renders: number;
  totalActual: number;
  totalSelf: number;
  maxActual: number;
  maxSelf: number;
  minSelf: number;
  avgSelf: number;
  wastedRenders: number;
  propsChanges: number;
  stateChanges: number;
  hooksChanges: number;
  contextChanges: number;
  firstMounts: number;
  history: number[];          // self duration per render
  commitIndices: number[];    // which commits this component appeared in
  parentNames: Set<string>;
  childNames: Set<string>;
}

export interface FiberSnapshot {
  id: number;
  displayName: string | null;
  children: number[];
  key: string | null;
  type: number;
  parentID: number | null;
}

export interface RootData {
  displayName: string;
  rootID: number;
  commits: CommitData[];
  components: ComponentStat[];
  fiberNames: Map<number, string | null>;
  fiberChildren: Map<number, number[]>;
  fiberParents: Map<number, number | null>;
  fiberSnapshots: Map<number, FiberSnapshot>;
  totalDuration: number;
  maxDuration: number;
  avgDuration: number;
  medianDuration: number;
  p95: number;
  p99: number;
  slowCommits: number;        // >16ms
  verySlowCommits: number;    // >50ms
  totalWasted: number;
  priorityCounts: Record<string, number>;
  updaterCounts: Record<string, number>;
  durationBuckets: number[];  // histogram buckets [0-1, 1-4, 4-8, 8-16, 16-50, 50+]
  timeRange: { start: number; end: number };
  commitDurationsByPriority: Record<string, number[]>;
  treeRoots: number[];        // root fiber IDs
}

export function parseProfilingData(raw: string | unknown): RootData[] {
  const json: any = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!json.dataForRoots || !Array.isArray(json.dataForRoots)) {
    throw new Error(
      'Invalid format — missing dataForRoots. Is this a React DevTools profiling export?'
    );
  }

  return json.dataForRoots.map((root: any, ri: number): RootData => {
    // ── Fiber snapshot map ──────────────────────────────────────────────────
    const fiberNames     = new Map<number, string | null>();
    const fiberChildren  = new Map<number, number[]>();
    const fiberParents   = new Map<number, number | null>();
    const fiberSnapshots = new Map<number, FiberSnapshot>();

    const snapshotsRaw: Array<[number, any]> = root.snapshots || [];
    for (const [id, snap] of snapshotsRaw) {
      const displayName = snap.displayName ?? null;
      const children    = snap.children   ?? [];
      fiberNames.set(id, displayName);
      fiberChildren.set(id, children);
      fiberSnapshots.set(id, {
        id,
        displayName,
        children,
        key:      snap.key      ?? null,
        type:     snap.type     ?? 0,
        parentID: null,
      });
    }

    // Build parent map
    for (const [id, children] of fiberChildren) {
      for (const childId of children) {
        fiberParents.set(childId, id);
      }
    }
    for (const [id] of fiberNames) {
      if (!fiberParents.has(id)) fiberParents.set(id, null);
    }

    // Update snapshots with parentID
    for (const [id, snap] of fiberSnapshots) {
      snap.parentID = fiberParents.get(id) ?? null;
    }

    // ── Tree roots (fibers with no parent) ────────────────────────────────
    const treeRoots: number[] = [];
    for (const [id] of fiberNames) {
      if (!fiberParents.get(id)) treeRoots.push(id);
    }

    // ── Parse commits ──────────────────────────────────────────────────────
    const commits: CommitData[] = (root.commitData || []).map((c: any, idx: number): CommitData => {
      const fiberActual = new Map<number, number>(c.fiberActualDurations || []);
      const fiberSelf   = new Map<number, number>(c.fiberSelfDurations   || []);
      const changeDesc  = new Map<number, ChangeDescription>();

      for (const [id, change] of (c.changeDescriptions || []) as Array<[number, any]>) {
        changeDesc.set(id, {
          isFirstMount:   change.isFirstMount    ?? false,
          props:          change.props           ?? null,
          state:          change.state           ?? null,
          hooks:          change.hooks           ?? null,
          didHooksChange: change.didHooksChange  ?? false,
          context:        change.context         ?? null,
        });
      }

      return {
        index:                idx,
        duration:             c.duration              || 0,
        timestamp:            c.timestamp             || 0,
        priorityLevel:        c.priorityLevel         || 'Normal',
        effectDuration:       c.effectDuration        || 0,
        passiveEffectDuration:c.passiveEffectDuration || 0,
        updaters: (c.updaters || []).map((u: any) => u.displayName || u.label || '').filter(Boolean),
        fiberActual,
        fiberSelf,
        changeDesc,
      };
    });

    // ── Aggregate per-component stats ─────────────────────────────────────
    const compMap = new Map<string, ComponentStat>();

    for (const commit of commits) {
      for (const [id, actual] of commit.fiberActual) {
        const name = fiberNames.get(id);
        if (!name) continue;

        if (!compMap.has(name)) {
          compMap.set(name, {
            name, id,
            renders: 0,
            totalActual: 0, totalSelf: 0,
            maxActual: 0, maxSelf: 0, minSelf: Infinity, avgSelf: 0,
            wastedRenders: 0,
            propsChanges: 0, stateChanges: 0, hooksChanges: 0, contextChanges: 0,
            firstMounts: 0,
            history: [],
            commitIndices: [],
            parentNames: new Set(),
            childNames: new Set(),
          });
        }
        const s = compMap.get(name)!;
        s.renders++;
        s.totalActual += actual;
        if (actual > s.maxActual) s.maxActual = actual;
        s.commitIndices.push(commit.index);
      }

      for (const [id, self] of commit.fiberSelf) {
        const name = fiberNames.get(id);
        if (!name || !compMap.has(name)) continue;
        const s = compMap.get(name)!;
        s.totalSelf += self;
        if (self > s.maxSelf) s.maxSelf = self;
        if (self < s.minSelf) s.minSelf = self;
        s.history.push(self);
      }

      for (const [id, change] of commit.changeDesc) {
        const name = fiberNames.get(id);
        if (!name || !compMap.has(name)) continue;
        const s = compMap.get(name)!;

        if (change.isFirstMount) {
          s.firstMounts++;
        } else {
          if (change.props   && change.props.length)           s.propsChanges++;
          if (Array.isArray(change.state) && change.state.length) s.stateChanges++;
          if (change.didHooksChange)                           s.hooksChanges++;
          if (change.context)                                  s.contextChanges++;

          const hasNoChange =
            (!change.props || !change.props.length) &&
            !change.didHooksChange &&
            !change.context &&
            (!Array.isArray(change.state) || !change.state.length);
          if (hasNoChange) s.wastedRenders++;
        }

        // Build tree relationships
        const parentId = fiberParents.get(id);
        if (parentId != null) {
          const parentName = fiberNames.get(parentId);
          if (parentName) s.parentNames.add(parentName);
        }
        for (const childId of fiberChildren.get(id) || []) {
          const childName = fiberNames.get(childId);
          if (childName) s.childNames.add(childName);
        }
      }
    }

    // Post-process
    for (const s of compMap.values()) {
      if (s.renders > 0) s.avgSelf = s.totalSelf / s.renders;
      if (s.minSelf === Infinity) s.minSelf = 0;
    }

    const components = [...compMap.values()].sort((a, b) => b.totalSelf - a.totalSelf);

    // ── Aggregate stats ───────────────────────────────────────────────────
    const durations = commits.map(c => c.duration);
    const totalDuration = durations.reduce((s, v) => s + v, 0);
    const maxDuration   = durations.length ? Math.max(...durations) : 0;
    const sorted        = [...durations].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1] || 0;
    const p99 = sorted[Math.ceil(0.99 * sorted.length) - 1] || 0;
    const median = sorted[Math.floor(sorted.length / 2)] || 0;

    const durationBuckets = [0, 0, 0, 0, 0, 0]; // [0-1, 1-4, 4-8, 8-16, 16-50, 50+]
    for (const d of durations) {
      if      (d < 1)  durationBuckets[0]++;
      else if (d < 4)  durationBuckets[1]++;
      else if (d < 8)  durationBuckets[2]++;
      else if (d < 16) durationBuckets[3]++;
      else if (d < 50) durationBuckets[4]++;
      else             durationBuckets[5]++;
    }

    const priorityCounts: Record<string, number> = {};
    const updaterCounts: Record<string, number>  = {};
    const commitDurationsByPriority: Record<string, number[]> = {};

    for (const c of commits) {
      priorityCounts[c.priorityLevel] = (priorityCounts[c.priorityLevel] || 0) + 1;
      if (!commitDurationsByPriority[c.priorityLevel]) commitDurationsByPriority[c.priorityLevel] = [];
      commitDurationsByPriority[c.priorityLevel].push(c.duration);
      for (const u of c.updaters) updaterCounts[u] = (updaterCounts[u] || 0) + 1;
    }

    const timestamps = commits.map(c => c.timestamp).filter(t => t > 0);

    return {
      displayName: root.displayName || `Root #${ri + 1}`,
      rootID: root.rootID || ri,
      commits,
      components,
      fiberNames,
      fiberChildren,
      fiberParents,
      fiberSnapshots,
      totalDuration,
      maxDuration,
      avgDuration:   commits.length ? totalDuration / commits.length : 0,
      medianDuration: median,
      p95, p99,
      slowCommits:     commits.filter(c => c.duration > 16).length,
      verySlowCommits: commits.filter(c => c.duration > 50).length,
      totalWasted: components.reduce((s, c) => s + c.wastedRenders, 0),
      priorityCounts,
      updaterCounts,
      durationBuckets,
      timeRange: {
        start: timestamps.length ? Math.min(...timestamps) : 0,
        end:   timestamps.length ? Math.max(...timestamps) : 0,
      },
      commitDurationsByPriority,
      treeRoots,
    };
  });
}
