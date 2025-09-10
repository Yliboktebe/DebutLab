import { createHash } from "node:crypto";

/** Стабильный id по UCIs (и опц. startFen), чтобы не дублировать ветки с одинаковым префиксом */
export function branchId(startFen: string, ucis: string[]): string {
  const h = createHash("sha1").update(startFen + "|" + ucis.join(" ")).digest("hex").slice(0, 12);
  return `b-${h}`;
}
