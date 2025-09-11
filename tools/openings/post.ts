import { Chess } from "chess.js";
import { UiBranch, PostProcessParams } from "./types.js";

export function dedupeByPrefix(branches: UiBranch[], prefixLen = 12): UiBranch[] {
  const seen = new Set<string>();
  const out: UiBranch[] = [];
  for (const b of branches) {
    const key = b.ucis.slice(0, prefixLen).join(" ");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(b);
    }
  }
  return out;
}

export function isTabiyaStop(fen: string, p?: PostProcessParams["tabiya"]): boolean {
  if (!p) return false;
  const game = new Chess(fen);

  // эвристика "достаточно развились"
  const developedOK = (countDevelopedMinors(game, "w") >= (p.minDevelopedEachSide ?? 2)) &&
                      (countDevelopedMinors(game, "b") >= (p.minDevelopedEachSide ?? 2));

  // эвристика "кто-то рокировал"
  const stopOnCastle = p.stopOnAnyCastling ? (isCastled(game, "w") || isCastled(game, "b")) : false;

  return developedOK || stopOnCastle;
}

function countDevelopedMinors(game: Chess, color: "w"|"b"): number {
  const starts = color === "w"
    ? new Set(["b1","g1","c1","f1"])
    : new Set(["b8","g8","c8","f8"]);
  let cnt = 0;
  for (const sq of allSquares()) {
    const piece = game.get(sq as any);
    if (!piece) continue;
    if (piece.color !== color) continue;
    if (piece.type === "n" || piece.type === "b") {
      if (!starts.has(sq)) cnt++;
    }
  }
  return cnt;
}

function isCastled(game: Chess, color: "w"|"b"): boolean {
  // упрощённо: король ушёл с e1/e8 на g1/c1/g8/c8
  for (const sq of allSquares()) {
    const p = game.get(sq as any);
    if (!p || p.color !== color || p.type !== "k") continue;
    if (color === "w" && (sq === "g1" || sq === "c1")) return true;
    if (color === "b" && (sq === "g8" || sq === "c8")) return true;
  }
  return false;
}

function allSquares(): string[] {
  const out: string[] = [];
  const files = "abcdefgh";
  for (let r = 1; r <= 8; r++) {
    for (let f = 0; f < 8; f++) out.push(`${files[f]}${r}`);
  }
  return out;
}