// old-path shim — TEMP, will be removed per TTL policy
export * from "@/ui/pages/HomePage";
export { default } from "@/ui/pages/HomePage";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/pages/HomePage' → use '@/ui/pages/HomePage'");
}

