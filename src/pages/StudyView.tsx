// old-path shim — TEMP, will be removed per TTL policy
export * from "@/ui/pages/StudyView";
export { default } from "@/ui/pages/StudyView";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[DEPRECATED] Import from '@/pages/StudyView' → use '@/ui/pages/StudyView'");
}

