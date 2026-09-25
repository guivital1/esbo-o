import type { BankStatementView, Source, TransactionAllocation } from "./types";

export type BankFilters = {
  dateFrom: string;
  dateTo: string;
  description: string;
  sourceNames: string[] | null;
  valueMin: string;
  valueMax: string;
  valueOrder: "none" | "asc" | "desc";
};

export const emptyBankFilters = (): BankFilters => ({ dateFrom: "", dateTo: "", description: "", sourceNames: null,
  valueMin: "", valueMax: "", valueOrder: "none" });

export const hasBankFilters = (filters: BankFilters, globalSearch = "") => Boolean(globalSearch.trim() ||
  filters.dateFrom || filters.dateTo || filters.description.trim() || filters.sourceNames !== null ||
  filters.valueMin || filters.valueMax || filters.valueOrder !== "none");

export function displayedSourceNames(row: BankStatementView["rows"][number], allocation: TransactionAllocation | undefined, sources: Source[]): string[] {
  if (!allocation) return [row.payor_source];
  return allocation.allocations.map((item) => sources.find((source) => source.id_fonte === item.id_fonte)?.nome_fonte ?? "Fonte indisponível");
}

export function availableSourceNames(rows: BankStatementView["rows"], allocations: Record<number, TransactionAllocation>, sources: Source[]): string[] {
  return [...new Set(rows.flatMap((row, index) => displayedSourceNames(row, allocations[index], sources)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function filterBankRows(statement: BankStatementView, allocations: Record<number, TransactionAllocation>, sources: Source[], filters: BankFilters, globalSearch: string) {
  const query = globalSearch.trim().toLocaleLowerCase("pt-BR");
  const description = filters.description.trim().toLocaleLowerCase("pt-BR");
  const min = filters.valueMin === "" ? null : Number(filters.valueMin);
  const max = filters.valueMax === "" ? null : Number(filters.valueMax);
  const selected = filters.sourceNames === null ? null : new Set(filters.sourceNames);
  const result = statement.rows.map((row, index) => ({ row, index })).filter(({ row, index }) => {
    const names = displayedSourceNames(row, allocations[index], sources);
    const amount = Number(row.amount);
    return (!filters.dateFrom || row.date >= filters.dateFrom) &&
      (!filters.dateTo || row.date <= filters.dateTo) &&
      (!description || row.description.toLocaleLowerCase("pt-BR").includes(description)) &&
      (!selected || names.some((name) => selected.has(name))) &&
      (min === null || amount >= min) && (max === null || amount <= max) &&
      (!query || `${row.description} ${names.join(" ")}`.toLocaleLowerCase("pt-BR").includes(query));
  });
  if (filters.valueOrder !== "none") result.sort((a, b) => {
    const difference = Number(a.row.amount) - Number(b.row.amount);
    return (filters.valueOrder === "asc" ? difference : -difference) || a.index - b.index;
  });
  return result;
}
