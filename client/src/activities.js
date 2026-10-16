export const activityBlocks = value => value ? value.split(/\n\s*\n/) : [];
export function moveActivity(items, index, direction) {
  const next = [...items], target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
