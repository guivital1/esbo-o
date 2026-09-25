import type { Source, SourceAllocation, StatementRow, TransactionAllocation } from "./types";

export type AllocationDraft = { id_fonte: string; amount: string };

export function parseCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(",");
  const cents = Number(whole.replaceAll(".", "")) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function statementCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Valor bancário inválido.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Valor bancário inválido.");
  return cents;
}

export function formatDraft(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export function draftFor(row: StatementRow, saved?: TransactionAllocation, sources: Source[] = []): AllocationDraft[] {
  if (saved) return saved.allocations.map((item) => ({ id_fonte: item.id_fonte, amount: formatDraft(item.amount_cents) }));
  const known = sources.find((source) => source.id_fonte === row.id_fonte && source.ativa);
  return [{ id_fonte: known?.id_fonte ?? "", amount: formatDraft(statementCents(row.amount)) }];
}

export function allocationSummary(row: StatementRow, draft: AllocationDraft[], sources: Source[]) {
  const original = statementCents(row.amount);
  const amounts = draft.map((item) => parseCents(item.amount));
  const total = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const ids = draft.map((item) => item.id_fonte);
  const validSources = ids.every((id) => Boolean(id) && sources.some((source) => source.id_fonte === id));
  const valid = draft.length > 0 && amounts.every((amount) => amount !== null) && validSources && new Set(ids).size === ids.length && total === original;
  return { original, total, remaining: original - total, valid };
}

export function confirmAllocation(transactionIndex: number, row: StatementRow, draft: AllocationDraft[], sources: Source[]): TransactionAllocation | null {
  const summary = allocationSummary(row, draft, sources);
  if (!summary.valid) return null;
  const allocations: SourceAllocation[] = draft.map((item) => ({
    id_fonte: item.id_fonte,
    amount_cents: parseCents(item.amount)!,
  }));
  return { transaction_index: transactionIndex, allocations, allocated_total_cents: summary.total, remaining_amount_cents: 0, status: allocations.length === 1 ? "identified" : "split" };
}
