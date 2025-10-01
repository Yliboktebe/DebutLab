// old-path shim — TEMP, will be removed per TTL policy
export * from "@/ui/components/DebutCatalog";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/components/DebutCatalog' → use '@/ui/components/DebutCatalog'");
}

