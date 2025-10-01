// old-path shim — TEMP, will be removed per TTL policy
export * from "@/core/study/srs";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/study/srs' → use '@/core/study/srs'");
}

