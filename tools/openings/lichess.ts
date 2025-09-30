// import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";
import { ExplorerResponse, CloudEvalResponse, Speed, RatingBucket } from "./types.js";
import Bottleneck from "bottleneck";
import { request } from "undici";
import { readCache, writeCache } from "./cache.js";

const EXPLORER_BASE = "https://explorer.lichess.ovh/lichess";
const CLOUD_EVAL    = "https://lichess.org/api/cloud-eval";

const limiter = new Bottleneck({ minTime: 120, maxConcurrent: 4 }); // ~8–10 req/с аккуратно

function h(obj: unknown) {
  return createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

export interface ExplorerParams {
  fen: string; // FEN позиции
  variant?: "standard";
  speeds?: Speed[];
  ratings?: RatingBucket[];
  since?: string; until?: string;
}

export async function explorerQuery(p: ExplorerParams): Promise<ExplorerResponse> {
  const qs = new URLSearchParams();
  qs.set("variant", p.variant ?? "standard");
  qs.set("fen", p.fen);
  if (p.speeds?.length)  qs.set("speeds", p.speeds.join(","));
  if (p.ratings?.length) qs.set("ratings", p.ratings.join(","));
  if (p.since) qs.set("since", p.since);
  if (p.until) qs.set("until", p.until);

  const key = `explorer:${h({ ...p, fen: p.fen })}`;
  const cached = await readCache(key);
  if (cached) return cached as ExplorerResponse;

  const url = `${EXPLORER_BASE}?${qs.toString()}`;
  const res = await limiter.schedule(() => request(url, { method: "GET" }));
  if (res.statusCode !== 200) throw new Error(`Explorer ${res.statusCode} ${url}`);

  const data = (await res.body.json()) as ExplorerResponse;
  await writeCache(key, data);
  return data;
}

export async function cloudEvalQuery(fen: string, multiPv: number): Promise<CloudEvalResponse | null> {
  const qs = new URLSearchParams({ fen, multiPv: String(multiPv) });
  const key = `cloudeval:${h({ fen, multiPv })}`;
  const cached = await readCache(key);
  if (cached) return cached as CloudEvalResponse;

  const url = `${CLOUD_EVAL}?${qs.toString()}`;
  const res = await limiter.schedule(() => request(url, { method: "GET" }));
  if (res.statusCode === 404) return null; // позиции нет в облаке — это норм
  if (res.statusCode !== 200) throw new Error(`CloudEval ${res.statusCode} ${url}`);

  const data = (await res.body.json()) as CloudEvalResponse;
  // бывают случаи, когда API отдаёт > multiPv — не страшно, фильтруем потом
  await writeCache(key, data);
  return data;
}
