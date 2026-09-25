import type { BankIdentification, Source } from "./types";

export type SourceStatusFilter = "all" | "active" | "inactive";

export const displaySourceNumber = (number: number) => Number.isInteger(number) && number > 0 ? String(number).padStart(3, "0") : "—";

export function filterSources(sources: Source[], query: string, status: SourceStatusFilter): Source[] {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return sources.filter((source) =>
    (status === "all" || source.ativa === (status === "active")) &&
    (!needle || `${source.nome_fonte} ${source.codigo_fonte ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle))
  );
}

export function identificationsForSource(items: BankIdentification[], id: string): BankIdentification[] {
  return items.filter((item) => item.id_fonte === id);
}

export const bankLabel = (bank: BankIdentification["bank"]) => bank === "safra" ? "Safra" : "BTG Pactual";
export const kindLabel = (kind: BankIdentification["kind"]) => ({ payor_alias: "Nome do pagador", description: "Descrição do extrato", document: "Documento" })[kind];
