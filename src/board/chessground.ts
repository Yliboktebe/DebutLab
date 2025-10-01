// old-path shim — TEMP, will be removed per TTL policy
export * from "@/core/chess/chessground";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/board/chessground' → use '@/core/chess/chessground'");
}

