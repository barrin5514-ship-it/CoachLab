// Shares a small in-memory YouTube search allowance across both search routes; restarts reset it.
export class YouTubeQuotaError extends Error {
  // null
  constructor() { super('YouTube search allowance reached. Try later; curated videos and manual links remain available.'); this.status = 429; }
}

// Shares rolling-day counters in this process only; a restart clears them.
export function createYouTubeQuota(now = Date.now) {
  let calls = [];
  return {
    // Reserves quota before an actual search, so simultaneous routes cannot overspend this process's allowance.
    take(userId) {
      const time = now();
      calls = calls.filter(call => time - call.time < 86400000);
      if (calls.length >= 80 || (userId && calls.filter(call => call.userId === userId).length >= 25)) throw new YouTubeQuotaError();
      calls.push({ time, userId });
    },
  };
}

export const youtubeQuota = createYouTubeQuota();
