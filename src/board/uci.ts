// old-path shim — TEMP, will be removed per TTL policy
export * from "@/core/chess/uci";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/board/uci' → use '@/core/chess/uci'");
}

