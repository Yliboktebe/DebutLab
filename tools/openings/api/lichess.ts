// tools/openings/api/lichess.ts
import { Limiter, fetchWithRetry } from '../lib/rateLimiter.js';

const DEFAULTS = {
  explorerConcurrency: 4,
  cloudConcurrency: 2, // будет принудительно понижен до 1
  retries: 4,
  baseDelayMs: 250,
  maxDelayMs: 4000,
};

// ---- NEW: глобальное состояние кулдауна CloudEval ----
let cloudCooldownUntil = 0;        // timestamp (ms)
let cloudCooldownLastLog = 0;      // чтобы не спамить лог
function isCloudCooling(): boolean {
  return Date.now() < cloudCooldownUntil;
}
function startCloudCooldown(minMs = 60_000, maxMs = 90_000) {
  const now = Date.now();
  const span = minMs + Math.floor(Math.random() * (maxMs - minMs + 1)); // 60–90s
  cloudCooldownUntil = Math.max(cloudCooldownUntil, now + span);
  // Лог — один раз при старте кулдауна (не спамим)
  if (now - cloudCooldownLastLog > 5_000) {
    const sec = Math.ceil((cloudCooldownUntil - now) / 1000);
    console.warn(`[CloudEval] 429 → cooldown ${sec}s`);
    cloudCooldownLastLog = now;
  }
}

export interface ApiInit {
  explorerConcurrency?: number;
  cloudConcurrency?: number;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class LichessApi {
  private explorerLimiter: Limiter;
  private cloudLimiter: Limiter;
  private retryOpts: { retries: number; baseDelayMs: number; maxDelayMs: number; retryOn: number[]; };

  constructor(init?: ApiInit) {
    this.explorerLimiter = new Limiter(init?.explorerConcurrency ?? DEFAULTS.explorerConcurrency);

    // ---- NEW: CloudEval всегда в 1 поток (требование Lichess для API) ----
    const requestedCloudConc = init?.cloudConcurrency ?? DEFAULTS.cloudConcurrency;
    const effectiveCloudConc = 1; // независимо от конфига
    if (requestedCloudConc !== 1) {
      console.warn(`[CloudEval] forcing concurrency to 1 (requested=${requestedCloudConc})`);
    }
    this.cloudLimiter = new Limiter(effectiveCloudConc);

    this.retryOpts = {
      retries: init?.retries ?? DEFAULTS.retries,
      baseDelayMs: init?.baseDelayMs ?? DEFAULTS.baseDelayMs,
      maxDelayMs: init?.maxDelayMs ?? DEFAULTS.maxDelayMs,
      // Explorer нормально ретраим и по 429 (там часто помогает), CloudEval — нет (см. метод ниже)
      retryOn: [429, 502, 503, 504],
    };
  }

  explorer(params: Record<string,string>): Promise<any> {
    const url = new URL('https://explorer.lichess.ovh/lichess');
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
    return this.explorerLimiter.run(async () => {
      const res = await fetchWithRetry(url, { method: 'GET' }, this.retryOpts);
      if (!res.ok) throw new Error(`Explorer ${res.status}`);
      return res.json();
    });
  }

  // ---- UPDATED: специальная логика CloudEval с кулдауном и без ретраев на 429 ----
  cloudEval(fen: string, multiPv = 3): Promise<any | undefined> {
    const url = new URL('https://lichess.org/api/cloud-eval');
    url.searchParams.set('fen', fen);
    url.searchParams.set('multiPv', String(multiPv));

    // Если кулдаун — сразу мягкий фолбэк (пропускаем движок на этой позиции)
    if (isCloudCooling()) return Promise.resolve(undefined);

    return this.cloudLimiter.run(async () => {
      // Повторная проверка внутри слота (на случай гонок)
      if (isCloudCooling()) return undefined;

      // ВАЖНО: не используем fetchWithRetry с 429 — при 429 сразу ставим кулдаун
      const res = await fetch(url, { method: 'GET' });

      if (res.status === 404) return undefined; // нет кэша — это нормально
      if (res.status === 429) {
        startCloudCooldown(60_000, 90_000);      // 60–90с кулдаун глобально
        return undefined;                        // мягкий фолбэк, генерация не прерывается
      }
      if (!res.ok) throw new Error(`CloudEval ${res.status}`);

      return res.json();
    });
  }
}
