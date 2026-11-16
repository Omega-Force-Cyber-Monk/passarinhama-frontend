export interface DraftSnapshot<T> { key: string; source: string; baseline: T }

// Server refreshes may replace pristine drafts, never edits made since initialization.
export function reconcileDraft<T>(previous: DraftSnapshot<T> | null, key: string, incoming: T, current: T, extraDirty = false) {
  const source = JSON.stringify(incoming);
  if (!previous || previous.key !== key || source === JSON.stringify(current)) return { value: incoming, snapshot: { key, source, baseline: incoming }, conflict: false };
  const dirty = extraDirty || JSON.stringify(current) !== JSON.stringify(previous.baseline);
  if (dirty) return { value: current, snapshot: previous, conflict: source !== previous.source };
  return { value: incoming, snapshot: { key, source, baseline: incoming }, conflict: false };
}
