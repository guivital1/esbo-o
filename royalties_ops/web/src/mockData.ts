// Design Lab only. Every name, identifier and amount below is invented.
import type { Artist, BankIdentification, BankStatementView, IngestionBatchDetails, ReconciliationView, Source } from "./types";

export const demoPeriod = (() => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
})();

export const demoSources: Source[] = [
  { id_fonte: "demo-source-a", numero_fonte: 101, codigo_fonte: "DEMO-A", nome_fonte: "Fonte Fictícia Aurora", tipo_fonte: "Digital", ativa: true },
  { id_fonte: "demo-source-b", numero_fonte: 102, codigo_fonte: "DEMO-B", nome_fonte: "Fonte Fictícia Brisa", tipo_fonte: "Editorial", ativa: true },
  { id_fonte: "demo-source-c", numero_fonte: 103, codigo_fonte: "DEMO-C", nome_fonte: "Fonte Fictícia Cais", tipo_fonte: "Digital", ativa: false },
];

export const demoIdentifications: BankIdentification[] = [
  { id: "demo-identification-a", id_fonte: "demo-source-a", bank: "safra", kind: "payor_alias", value: "PAGADOR FICTICIO A", canonical_royalty_source: "Fonte Fictícia Aurora", ativa: true },
  { id: "demo-identification-b", id_fonte: "demo-source-b", bank: "safra", kind: "description", value: "RECEBIMENTO DEMONSTRATIVO B", canonical_royalty_source: "Fonte Fictícia Brisa", ativa: true },
];

export const demoArtists: Artist[] = [
  { id_artista: "demo-artist-a", nome_artista: "Artista Demo A", ativa: true },
  { id_artista: "demo-artist-b", nome_artista: "Artista Demo B", ativa: true },
  { id_artista: "demo-artist-c", nome_artista: "Artista Demo C", ativa: true },
];

export const demoStatement: BankStatementView = {
  id_extrato: "demo-statement-mdb", version: 1, is_current: true,
  imported_at: `${demoPeriod}-28T12:00:00Z`, already_imported: false, allocations: {},
  entity: "MDB", bank: "Safra", period: demoPeriod, file_name: "extrato_ficticio_demo.pdf",
  status: "review", status_label: "Com pendências", statement_period_start: `${demoPeriod}-01`, statement_period_end: `${demoPeriod}-28`,
  displayed_count: 3, review_count: 1, displayed_total: "2750.00",
  rows: [
    { id_transacao: "demo-transaction-a", date: `${demoPeriod}-05`, description: "CRÉDITO FICTÍCIO A", payor_source: "Fonte Fictícia Aurora", id_fonte: "demo-source-a", amount: "1500.00", review_required: false },
    { id_transacao: "demo-transaction-b", date: `${demoPeriod}-14`, description: "CRÉDITO FICTÍCIO B", payor_source: "Fonte Fictícia Brisa", id_fonte: "demo-source-b", amount: "750.00", review_required: false },
    { id_transacao: "demo-transaction-c", date: `${demoPeriod}-23`, description: "CRÉDITO FICTÍCIO SEM FONTE", payor_source: "Não identificada", id_fonte: null, amount: "500.00", review_required: true },
  ],
};

export const demoReconciliation: ReconciliationView = {
  id_conciliacao: "demo-reconciliation-mdb", bank_statement_id: "demo-statement-mdb", entity: "MDB", period: demoPeriod,
  bank_statement_version: 1, status: "EM_ANDAMENTO", created_at: `${demoPeriod}-28T12:30:00Z`, validated_at: null,
  pending_bank_count: 1, pending_bank_amount: "500.00",
  totals: { received: "2750.00", catalog_gross: "1900.00", gross_balance: "850.00", received_percent: "100.00", catalog_gross_percent: "69.09", gross_balance_percent: "30.91" },
  rows: [
    { id_fonte: "demo-source-a", numero_fonte: 101, nome_fonte: "Fonte Fictícia Aurora", assignee: "Guilherme Vital", recebido: "1500.00", catalogo_bruto: "1200.00", saldo_bruto: "300.00", entries: [
      { id: "demo-entry-a", tipo: "IMPORTACAO", origem: "Demonstração fictícia", referencia: "Exemplo A-01", valor: "800.00", data: `${demoPeriod}-08`, id_artista: "demo-artist-a", nome_artista: "Artista Demo A" },
      { id: "demo-entry-b", tipo: "IMPORTACAO", origem: "Demonstração fictícia", referencia: "Exemplo A-02", valor: "400.00", data: `${demoPeriod}-12`, id_artista: "demo-artist-b", nome_artista: "Artista Demo B" },
    ] },
    { id_fonte: "demo-source-b", numero_fonte: 102, nome_fonte: "Fonte Fictícia Brisa", assignee: "Equipe Backoffice", recebido: "750.00", catalogo_bruto: "700.00", saldo_bruto: "50.00", entries: [
      { id: "demo-entry-c", tipo: "IMPORTACAO", origem: "Demonstração fictícia", referencia: "Exemplo B-01", valor: "700.00", data: `${demoPeriod}-17`, id_artista: "demo-artist-c", nome_artista: "Artista Demo C" },
    ] },
    { id_fonte: "demo-source-c", numero_fonte: 103, nome_fonte: "Fonte Fictícia Cais", recebido: "0.00", catalogo_bruto: "0.00", saldo_bruto: "0.00", entries: [] },
  ],
};

export const demoBatch: IngestionBatchDetails = {
  id: "demo-batch-a", tipo: "AUTOMATICA", origem: "Demonstração fictícia", arquivo: "catalogo_ficticio_demo.csv",
  sha256: null, status: "CONCLUIDO", linhas: 3, valor_total: "1900.00", importado_em: `${demoPeriod}-28T13:00:00Z`,
  entries: [
    { data: `${demoPeriod}-08`, id_fonte: "demo-source-a", nome_fonte: "Fonte Fictícia Aurora", id_artista: "demo-artist-a", nome_artista: "Artista Demo A", valor: "800.00", origem: "Demonstração fictícia", referencia: "Exemplo A-01" },
    { data: `${demoPeriod}-12`, id_fonte: "demo-source-a", nome_fonte: "Fonte Fictícia Aurora", id_artista: "demo-artist-b", nome_artista: "Artista Demo B", valor: "400.00", origem: "Demonstração fictícia", referencia: "Exemplo A-02" },
    { data: `${demoPeriod}-17`, id_fonte: "demo-source-b", nome_fonte: "Fonte Fictícia Brisa", id_artista: "demo-artist-c", nome_artista: "Artista Demo C", valor: "700.00", origem: "Demonstração fictícia", referencia: "Exemplo B-01" },
  ],
};
