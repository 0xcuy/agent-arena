import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { EvidenceLogEntry } from "./types.js";

/**
 * evidence-log.jsonl is the local ledger that enforces two competition rules the API
 * cannot enforce for us:
 *  - dedupe: never research or submit the same fact twice (fact signature match)
 *  - one-directional stance per market: evidence for both sides nets to $0 settlement
 *    value, so once a stance is locked for a market, the opposite stance is refused.
 * Append-only; one JSON object per line.
 */

export class EvidenceLog {
  private entries: EvidenceLogEntry[] = [];

  constructor(readonly path: string) {
    if (existsSync(path)) {
      for (const line of readFileSync(path, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        this.entries.push(JSON.parse(t) as EvidenceLogEntry);
      }
    }
  }

  all(): EvidenceLogEntry[] {
    return [...this.entries];
  }

  forMarket(address: string): EvidenceLogEntry[] {
    return this.entries.filter((e) => e.marketAddress === address);
  }

  /** The stance already taken on a market, if any (drafted or submitted entries only). */
  lockedStance(address: string): "yes" | "no" | null {
    const active = this.forMarket(address).filter((e) => e.status !== "rejected");
    if (active.length === 0) return null;
    return active[0]!.stance;
  }

  hasSignature(signature: string): boolean {
    return this.entries.some((e) => e.factSignature === signature && e.status !== "rejected");
  }

  submittedCount(address: string): number {
    return this.forMarket(address).filter((e) => e.status === "submitted").length;
  }

  draftedCount(address: string): number {
    return this.forMarket(address).filter((e) => e.status === "drafted" || e.status === "submitted").length;
  }

  append(entry: EvidenceLogEntry): void {
    this.entries.push(entry);
    appendFileSync(this.path, JSON.stringify(entry) + "\n", "utf-8");
  }
}

export function factSignature(marketAddress: string, headline: string, figures: string[]): string {
  return sha256(marketAddress + "|" + headline + "|" + figures.join("|"));
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}
