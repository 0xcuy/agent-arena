import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import type { EvidenceLogEntry } from "./types.js";

/**
 * evidence-log.jsonl is the local ledger that enforces two competition rules the API
 * cannot enforce for us:
 *  - dedupe: never research or submit the same fact twice (fact signature match)
 *  - one-directional stance per market: evidence for both sides nets to $0 settlement
 *    value, so once a stance is locked for a market, the opposite stance is refused.
 * Entries are mode-tagged: a run only ever sees entries written by the SAME mode
 * (fix 11) — a mock "drafted" entry can never block a live run or consume its
 * per-market cap, and vice versa. Entries written before the mode tag existed are
 * treated as mock (they were).
 * Append-only; one JSON object per line.
 */

const norm = (address: string) => address.trim().toLowerCase();

export class EvidenceLog {
  private entries: EvidenceLogEntry[] = [];

  constructor(readonly path: string, private readonly mode: "mock" | "live") {
    if (existsSync(path)) {
      for (const line of readFileSync(path, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        const entry = JSON.parse(t) as EvidenceLogEntry;
        entry.mode ??= "mock"; // legacy run-1 entries were all mock
        this.entries.push(entry);
      }
    }
  }

  /** Only entries written by the same mode are visible to this log instance. */
  private visible(): EvidenceLogEntry[] {
    return this.entries.filter((e) => (e.mode ?? "mock") === this.mode);
  }

  all(): EvidenceLogEntry[] {
    return this.visible();
  }

  forMarket(address: string): EvidenceLogEntry[] {
    const a = norm(address);
    return this.visible().filter((e) => norm(e.marketAddress) === a);
  }

  /** The stance already taken on a market, if any (drafted or submitted entries only). */
  lockedStance(address: string): "yes" | "no" | null {
    const active = this.forMarket(address).filter((e) => e.status !== "rejected");
    if (active.length === 0) return null;
    return active[0]!.stance;
  }

  hasSignature(signature: string): boolean {
    return this.visible().some((e) => e.factSignature === signature && e.status !== "rejected");
  }

  submittedCount(address: string): number {
    return this.forMarket(address).filter((e) => e.status === "submitted").length;
  }

  draftedCount(address: string): number {
    return this.forMarket(address).filter((e) => e.status === "drafted" || e.status === "submitted").length;
  }

  /** Update fields of an existing entry in place (used by the submitter write-back) and rewrite the file. */
  update(address: string, factSignature: string, patch: Partial<EvidenceLogEntry>): void {
    const a = norm(address);
    const entry = this.entries.find((e) => norm(e.marketAddress) === a && e.factSignature === factSignature);
    if (!entry) throw new Error(`ledger update: no entry for ${address} / ${factSignature.slice(0, 12)}`);
    Object.assign(entry, patch);
    // The ledger is append-only for run artifacts; the one sanctioned in-place rewrite
    // is the submission write-back (drafted -> submitted + submission id).
    writeFileSync(this.path, this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf-8");
  }

  append(entry: EvidenceLogEntry): void {
    const withMode: EvidenceLogEntry = { mode: this.mode, ...entry };
    this.entries.push(withMode);
    appendFileSync(this.path, JSON.stringify(withMode) + "\n", "utf-8");
  }
}

export function factSignature(marketAddress: string, headline: string, figures: string[]): string {
  return sha256(norm(marketAddress) + "|" + headline + "|" + figures.join("|"));
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf-8").digest("hex");
}
