// tools/openings/lib/rateLimiter.ts
type Task<T> = () => Promise<T>;

export class Limiter {
  private q: Task<any>[] = [];
  private running = 0;
  constructor(private readonly concurrency: number) {}

  run<T>(t: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try { resolve(await t()); }
        catch (e) { reject(e); }
        finally { this.running--; this.pump(); }
      };
      this.q.push(task);
      this.pump();
    });
  }

  private pump() {
    while (this.running < this.concurrency && this.q.length) {
      const task = this.q.shift()!;
      this.running++;
      void task();
    }
  }
}

export interface RetryOpts {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn: number[]; // HTTP статусы
}

export function jitter(ms: number) {
  const delta = ms * 0.2;
  return Math.round(ms + (Math.random()*2 - 1) * delta);
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  opts: RetryOpts
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(input, init);
    if (!opts.retryOn.includes(res.status)) return res;
    if (attempt >= opts.retries) return res;
    const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * Math.pow(2, attempt));
    await new Promise(r => setTimeout(r, jitter(exp)));
    attempt++;
  }
}

