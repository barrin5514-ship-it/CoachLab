export class YouTubeQuotaError extends Error {
  constructor() { super('YouTube search allowance reached. Try later; curated videos and manual links remain available.'); this.status = 429; }
}

export function createYouTubeQuota(now = Date.now) {
  let calls = [];
  return {
    take(userId) {
      const time = now();
      calls = calls.filter(call => time - call.time < 86400000);
      if (calls.length >= 80 || (userId && calls.filter(call => call.userId === userId).length >= 25)) throw new YouTubeQuotaError();
      calls.push({ time, userId });
    },
  };
}

export const youtubeQuota = createYouTubeQuota();
