import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { UiDebutFile, GlobalParams, UiBranch } from "./types.js";

export async function writeUiFile(outDir: string, id: string, side: "white"|"black", branches: UiBranch[], g: GlobalParams, filters: unknown) {
  const payload: UiDebutFile = {
    id, side, branches,
    meta: { source: "lichess", filters, version: 1 }
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${id}.json`), JSON.stringify(payload, null, 2), "utf8");
}
