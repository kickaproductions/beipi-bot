import {setTimeout as wait} from 'node:timers/promises';

const batchBudgetMs = 40_000;
const requestTimeoutMs = 6_000;
const clockBufferMs = 100;

function seconds(value: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function createDiscordReactionBatch(botToken: string, channelId: string, messageId: string) {
  const deadline = Date.now() + batchBudgetMs;
  const route = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions`;
  let nextRequestAt = 0;
  let lastRateLimit: Response | undefined;

  return async function requestReaction(emoji: string, method: 'PUT' | 'DELETE' = 'PUT') {
    while (true) {
      if (Math.max(Date.now(), nextRequestAt) >= deadline) {
        return lastRateLimit ?? Response.json({message: 'Discord took too long to finish adding reactions.'}, {status: 429});
      }
      const delay = nextRequestAt - Date.now();
      if (delay > 0) await wait(delay);
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return lastRateLimit ?? Response.json({message: 'Discord took too long to finish adding reactions.'}, {status: 429});
      }

      let response: Response;
      try {
        response = await fetch(`${route}/${encodeURIComponent(emoji)}/@me`, {
          method,
          headers: {Authorization: `Bot ${botToken}`},
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.min(remaining, requestTimeoutMs)),
        });
      } catch {
        return Response.json({message: 'Discord did not respond to the reaction request. Try again shortly.'}, {status: 502});
      }

      if (response.status !== 429) {
        lastRateLimit = undefined;
        if (response.headers.get('X-RateLimit-Remaining') === '0') {
          const reset = seconds(response.headers.get('X-RateLimit-Reset-After'));
          if (reset) nextRequestAt = Date.now() + Math.ceil(reset * 1_000) + clockBufferMs;
        }
        return response;
      }

      lastRateLimit = response;
      const body = await response.clone().json().catch(() => null) as {retry_after?: number} | null;
      const retry = Math.max(seconds(body?.retry_after), seconds(response.headers.get('Retry-After'))) || 1;
      nextRequestAt = Date.now() + Math.ceil(retry * 1_000) + clockBufferMs;
    }
  };
}
