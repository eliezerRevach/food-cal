/** Last comma-separated segment, then last whitespace token — min length 2 to query. */
export function activeSearchQuery(value: string): string | null {
  const lastComma = value.lastIndexOf(',');
  const segment = lastComma === -1 ? value : value.slice(lastComma + 1);
  const m = segment.match(/(\S+)$/);
  if (!m) return null;
  const q = m[1];
  return q.length >= 2 ? q : null;
}

/** Replace the last token in the last segment with `replacement`. */
export function replaceActiveToken(value: string, replacement: string): string {
  const lastComma = value.lastIndexOf(',');
  const prefix = lastComma === -1 ? '' : value.slice(0, lastComma + 1);
  const segment = lastComma === -1 ? value : value.slice(lastComma + 1);
  const m = segment.match(/^(.*?)(\S+)$/);
  if (!m) return prefix + replacement;
  return prefix + m[1] + replacement;
}
