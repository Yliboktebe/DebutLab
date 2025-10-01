// old-path shim — TEMP, will be removed per TTL policy
export * from "@/ui/components/ChessBoard";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/components/ChessBoard' → use '@/ui/components/ChessBoard'");
}

