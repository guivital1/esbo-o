export type StatementRow = {
  id_transacao?: string;
  date: string;
  description: string;
  payor_source: string;
  id_fonte?: string | null;
  amount: string;
  review_required: boolean;
};

export type Source = { id_fonte: string; numero_fonte: number; codigo_fonte: string | null; nome_fonte: string; tipo_fonte: string | null; ativa: boolean };
export type BankIdentification = {
  id?: string;
  id_fonte: string;
  bank: "safra" | "btg";
  kind: "payor_alias" | "description" | "document";
  value: string;
  canonical_royalty_source: string;
  ativa?: boolean;
};
export type SourceAllocation = { id_fonte: string; amount_cents: number };
export type TransactionAllocation = {
  transaction_index: number;
  allocations: SourceAllocation[];
  allocated_total_cents: number;
  remaining_amount_cents: number;
  status: "identified" | "split";
};

export type BankStatementView = {
  id_extrato?: string;
  version?: number;
  is_current?: boolean;
  imported_at?: string;
  already_imported?: boolean;
  allocations?: Record<string, TransactionAllocation>;
  entity: "HM" | "MDB";
  bank: string;
  period: string;
  file_name: string;
  status: "validated" | "review";
  status_label: "Validado" | "Requer revisão" | "Com pendências";
  statement_period_start: string | null;
  statement_period_end: string | null;
  displayed_count: number;
  review_count: number;
  displayed_total: string;
  rows: StatementRow[];
};

export type BankStatementSummary = Pick<BankStatementView, "id_extrato" | "entity" | "bank" | "period" | "file_name" | "status" | "status_label" | "displayed_count" | "review_count" | "displayed_total" | "version" | "is_current" | "imported_at"> & { id_extrato: string; version: number; is_current: boolean; imported_at: string };

export type CatalogEntry = { id: string; tipo: "MANUAL" | "IMPORTACAO"; origem: string; referencia: string; valor: string; data: string; data_referencia?: string | null; id_artista?: string | null; nome_artista?: string | null };
export type Artist = { id_artista: string; nome_artista: string; ativa: boolean };
export type IngestionPreviewRow = { linha: number; data: string; fonte: string; artista: string; valor: string; situacao: "VALIDA" | "BLOQUEADA"; erros: string[]; avisos: string[] };
export type IngestionPreview = { arquivo: string; origem: string; sha256: string; linhas_totais: number; linhas_validas: number; linhas_bloqueadas: number; warnings: number; valor_total_valido: string; fontes_afetadas: number; artistas_afetados: number; erros: string[]; linhas: IngestionPreviewRow[]; pode_confirmar: boolean };
export type IngestionBatch = { id: string; tipo: "AUTOMATICA" | "MANUAL"; origem: string; arquivo: string | null; sha256: string | null; status: string; linhas: number; valor_total: string; importado_em: string };
export type IngestionBatchEntry = { data: string; id_fonte: string; nome_fonte: string; id_artista: string; nome_artista: string; valor: string; origem: string; referencia: string };
export type IngestionBatchDetails = IngestionBatch & { entries: IngestionBatchEntry[] };
export type ReconciliationRow = { id_fonte: string; numero_fonte: number | null; nome_fonte: string; assignee?: string; recebido: string; catalogo_bruto: string; saldo_bruto: string; entries: CatalogEntry[] };
export type ReconciliationSummary = { id_conciliacao: string; bank_statement_id: string; entity: "HM" | "MDB"; period: string; bank_statement_version: number; status: string; created_at: string };
export type ReconciliationView = ReconciliationSummary & { validated_at: string | null; pending_bank_count: number; pending_bank_amount: string;
  totals: { received: string; catalog_gross: string; gross_balance: string; received_percent: string | null; catalog_gross_percent: string | null; gross_balance_percent: string | null }; rows: ReconciliationRow[] };
