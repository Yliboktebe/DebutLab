// old-path shim — TEMP, will be removed per TTL policy
export * from "@/ui/pages/DebutPage";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/pages/DebutPage' → use '@/ui/pages/DebutPage'");
}

