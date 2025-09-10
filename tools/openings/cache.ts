import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const DIR = ".cache/openings";
await mkdir(DIR, { recursive: true });

export async function readCache(key: string) {
  try { return JSON.parse(await readFile(join(DIR, `${key}.json`), "utf8")); }
  catch { return null; }
}
export async function writeCache(key: string, data: unknown) {
  await writeFile(join(DIR, `${key}.json`), JSON.stringify(data));
}
