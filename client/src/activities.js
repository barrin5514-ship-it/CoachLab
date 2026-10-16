export const activityBlocks = value => value ? value.split(/\n\s*\n/) : [];
export const joinActivities = items => items.map(text => text.replace(/\n\s*\n+/g, '\n')).join('\n\n');
export function moveActivity(items, index, direction) {
  const next = [...items], target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function activityMinutes(value) {
  return activityBlocks(value).reduce((sum, block) => {
    const match = block.split('\n')[0].match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/i);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);
}
