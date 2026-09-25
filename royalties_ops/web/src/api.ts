// Local, volatile Design Lab adapter. No fetch, network, storage or production API.
import type { Artist, BankIdentification, BankStatementSummary, BankStatementView, IngestionBatch, IngestionBatchDetails, IngestionPreview,
  ReconciliationSummary, ReconciliationView, Source, SourceAllocation } from "./types";
import { demoArtists, demoBatch, demoIdentifications, demoPeriod, demoReconciliation, demoSources, demoStatement } from "./mockData";

export type MockScenario = "data" | "empty";
export type NewSource = { nome_fonte: string; codigo_fonte: string; tipo_fonte: string | null };
export type NewBankIdentification = { id_fonte: string; bank: "safra" | "btg"; kind: "payor_alias" | "description" | "document"; value: string };
type StatementInput = { entity: BankStatementView["entity"]; period: string; file: File };
type StatementFilters = { entity?: string; bank?: string; period?: string };

const copy = <T,>(value: T): T => structuredClone(value);
const aborted = (signal?: AbortSignal) => signal?.throwIfAborted();
let scenario: MockScenario = "data";
let sources: Source[] = [];
let identifications: BankIdentification[] = [];
let statements: BankStatementView[] = [];
let reconciliations: ReconciliationView[] = [];
let batches: Record<string, IngestionBatchDetails[]> = {};
let sequence = 0;

function reset() {
  sources = scenario === "data" ? copy(demoSources) : [];
  identifications = scenario === "data" ? copy(demoIdentifications) : [];
  statements = scenario === "data" ? [copy(demoStatement)] : [];
  reconciliations = scenario === "data" ? [copy(demoReconciliation)] : [];
  batches = scenario === "data" ? { [demoReconciliation.id_conciliacao]: [copy(demoBatch)] } : {};
  sequence = 0;
}
reset();
const nextId = (name: string) => `demo-${name}-${++sequence}`;
export const getMockScenario = () => scenario;
export function setMockScenario(next: MockScenario) { scenario = next; reset(); }

export async function getSources(signal?: AbortSignal): Promise<Source[]> { aborted(signal); return copy(sources); }
export async function createSource(input: NewSource): Promise<Source> {
  const source: Source = { id_fonte: nextId("source"), numero_fonte: Math.max(100, ...sources.map((item) => item.numero_fonte)) + 1,
    codigo_fonte: input.codigo_fonte || null, nome_fonte: input.nome_fonte, tipo_fonte: input.tipo_fonte, ativa: true };
  sources.push(source); return copy(source);
}
export async function updateSource(id: string, input: NewSource): Promise<Source> {
  const source = sources.find((item) => item.id_fonte === id);
  if (!source) throw new Error("Fonte demonstrativa não encontrada.");
  Object.assign(source, { nome_fonte: input.nome_fonte, codigo_fonte: input.codigo_fonte || null, tipo_fonte: input.tipo_fonte });
  return copy(source);
}
export async function setSourceActive(id: string, active: boolean): Promise<Source> {
  const source = sources.find((item) => item.id_fonte === id);
  if (!source) throw new Error("Fonte demonstrativa não encontrada.");
  source.ativa = active; return copy(source);
}
export async function getBankIdentifications(signal?: AbortSignal): Promise<BankIdentification[]> { aborted(signal); return copy(identifications); }
export async function createBankIdentification(input: NewBankIdentification): Promise<BankIdentification> {
  const source = sources.find((item) => item.id_fonte === input.id_fonte);
  if (!source) throw new Error("Fonte demonstrativa não encontrada.");
  const item: BankIdentification = { ...input, id: nextId("identification"), canonical_royalty_source: source.nome_fonte, ativa: true };
  identifications.push(item); return copy(item);
}

const summary = (item: BankStatementView): BankStatementSummary => ({
  id_extrato: item.id_extrato!, entity: item.entity, bank: item.bank, period: item.period, file_name: item.file_name,
  status: item.status, status_label: item.status_label, displayed_count: item.displayed_count, review_count: item.review_count,
  displayed_total: item.displayed_total, version: item.version!, is_current: item.is_current!, imported_at: item.imported_at!,
});
export async function getBankStatements(filters: StatementFilters = {}, signal?: AbortSignal): Promise<BankStatementSummary[]> {
  aborted(signal);
  return copy(statements.filter((item) => (!filters.entity || item.entity === filters.entity) &&
    (!filters.period || item.period === filters.period) &&
    (!filters.bank || item.bank.toUpperCase().includes(filters.bank.toUpperCase()))).map(summary));
}
export async function getBankStatement(id: string, signal?: AbortSignal): Promise<BankStatementView> {
  aborted(signal);
  const item = statements.find((row) => row.id_extrato === id);
  if (!item) throw new Error("Extrato demonstrativo não encontrado.");
  return copy(item);
}
export class StatementVersionConflict extends Error {
  readonly currentStatementId: string;
  constructor(message: string, currentStatementId: string) { super(message); this.currentStatementId = currentStatementId; }
}
export async function importBankStatement(input: StatementInput, options: { expectedCurrentId?: string } = {}, signal?: AbortSignal): Promise<BankStatementView> {
  aborted(signal);
  // File bytes and names are deliberately ignored.
  void input.file;
  const current = statements.find((item) => item.entity === input.entity && item.period === input.period && item.is_current);
  if (current && !options.expectedCurrentId) throw new StatementVersionConflict("Confirme a nova versão demonstrativa.", current.id_extrato!);
  if (current && options.expectedCurrentId !== current.id_extrato) throw new Error("A versão demonstrativa mudou. Tente novamente.");
  if (current) current.is_current = false;
  const item = copy(demoStatement);
  item.id_extrato = nextId("statement"); item.entity = input.entity; item.bank = input.entity === "MDB" ? "Safra" : "BTG Pactual";
  item.period = input.period; item.file_name = "extrato_ficticio_importado.pdf"; item.version = current ? (current.version ?? 0) + 1 : 1;
  item.imported_at = new Date().toISOString(); item.statement_period_start = `${input.period}-01`;
  item.statement_period_end = `${input.period}-28`;
  item.rows = item.rows.map((row) => ({ ...row, id_transacao: nextId("transaction"), date: row.date.replace(demoPeriod, input.period) }));
  statements.push(item); return copy(item);
}
export async function saveStatementAllocations(statementId: string, transactionId: string, allocations: SourceAllocation[]): Promise<BankStatementView> {
  const item = statements.find((row) => row.id_extrato === statementId);
  const index = item?.rows.findIndex((row) => row.id_transacao === transactionId) ?? -1;
  if (!item || index < 0) throw new Error("Recebimento demonstrativo não encontrado.");
  const total = allocations.reduce((sum, row) => sum + row.amount_cents, 0);
  const amount = Math.round(Number(item.rows[index].amount) * 100);
  item.allocations ??= {};
  item.allocations[index] = { transaction_index: index, allocations: copy(allocations), allocated_total_cents: total,
    remaining_amount_cents: amount - total, status: allocations.length > 1 ? "split" : "identified" };
  item.review_count = item.rows.filter((row, at) => row.review_required && !item.allocations?.[at]).length;
  item.status = item.review_count ? "review" : "validated";
  item.status_label = item.review_count ? "Com pendências" : "Validado";
  reconciliations.filter((reconciliation) => reconciliation.bank_statement_id === statementId).forEach(recalculate);
  return copy(item);
}
export async function exportSavedBankStatement(_id: string, signal?: AbortSignal): Promise<void> {
  aborted(signal);
  throw new Error("Exportação indisponível nesta prévia. Nenhum arquivo operacional é gerado.");
}

const reconciliationSummary = (item: ReconciliationView): ReconciliationSummary => ({
  id_conciliacao: item.id_conciliacao, bank_statement_id: item.bank_statement_id, entity: item.entity,
  period: item.period, bank_statement_version: item.bank_statement_version, status: item.status, created_at: item.created_at,
});
export async function getReconciliations(entity?: string, period?: string, signal?: AbortSignal): Promise<ReconciliationSummary[]> {
  aborted(signal); return copy(reconciliations.filter((item) => (!entity || item.entity === entity) && (!period || item.period === period)).map(reconciliationSummary));
}
export async function getReconciliation(id: string, signal?: AbortSignal): Promise<ReconciliationView> {
  aborted(signal); const item = reconciliations.find((row) => row.id_conciliacao === id);
  if (!item) throw new Error("Conciliação demonstrativa não encontrada.");
  recalculate(item);
  return copy(item);
}
export async function createReconciliation(bankStatementId: string): Promise<ReconciliationView> {
  const statement = statements.find((item) => item.id_extrato === bankStatementId);
  if (!statement) throw new Error("Extrato demonstrativo não encontrado.");
  const existing = reconciliations.find((item) => item.bank_statement_id === bankStatementId);
  if (existing) return copy(existing);
  const item = copy(demoReconciliation);
  item.id_conciliacao = nextId("reconciliation"); item.bank_statement_id = bankStatementId;
  item.entity = statement.entity; item.period = statement.period; item.bank_statement_version = statement.version ?? 1;
  item.created_at = new Date().toISOString();
  item.rows = sources.map((source) => {
    const received = statement.rows.filter((row) => row.id_fonte === source.id_fonte)
      .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    return { id_fonte: source.id_fonte, numero_fonte: source.numero_fonte, nome_fonte: source.nome_fonte,
      recebido: (received / 100).toFixed(2), catalogo_bruto: "0.00", saldo_bruto: (received / 100).toFixed(2), entries: [] };
  });
  item.pending_bank_count = statement.rows.filter((row) => !row.id_fonte).length;
  item.pending_bank_amount = (statement.rows.filter((row) => !row.id_fonte)
    .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100).toFixed(2);
  recalculate(item);
  reconciliations.push(item); batches[item.id_conciliacao] = [];
  return copy(item);
}
function recalculate(item: ReconciliationView) {
  const cents = (value: string) => Math.round(Number(value) * 100);
  const money = (value: number) => (value / 100).toFixed(2);
  const statement = statements.find((row) => row.id_extrato === item.bank_statement_id);
  if (statement) {
    const receivedBySource = new Map<string, number>();
    statement.rows.forEach((bankRow, index) => {
      const allocation = statement.allocations?.[index];
      if (allocation) allocation.allocations.forEach((part) =>
        receivedBySource.set(part.id_fonte, (receivedBySource.get(part.id_fonte) ?? 0) + part.amount_cents));
      else if (bankRow.id_fonte) receivedBySource.set(bankRow.id_fonte,
        (receivedBySource.get(bankRow.id_fonte) ?? 0) + cents(bankRow.amount));
    });
    for (const sourceId of receivedBySource.keys()) {
      if (item.rows.some((row) => row.id_fonte === sourceId)) continue;
      const source = sources.find((candidate) => candidate.id_fonte === sourceId);
      if (source) item.rows.push({ id_fonte: source.id_fonte, numero_fonte: source.numero_fonte, nome_fonte: source.nome_fonte,
        recebido: "0.00", catalogo_bruto: "0.00", saldo_bruto: "0.00", entries: [] });
    }
    item.rows.forEach((row) => { row.recebido = money(receivedBySource.get(row.id_fonte) ?? 0); });
    const pendingRows = statement.rows.filter((bankRow, index) => bankRow.review_required && !statement.allocations?.[index]);
    item.pending_bank_count = pendingRows.length;
    item.pending_bank_amount = money(pendingRows.reduce((sum, bankRow) => sum + cents(bankRow.amount), 0));
  }
  let catalog = 0;
  for (const row of item.rows) {
    const rowCatalog = row.entries.reduce((sum, entry) => sum + cents(entry.valor), 0);
    row.catalogo_bruto = money(rowCatalog); row.saldo_bruto = money(cents(row.recebido) - rowCatalog); catalog += rowCatalog;
  }
  const received = Math.round(Number(statements.find((row) => row.id_extrato === item.bank_statement_id)?.displayed_total ?? "0") * 100);
  item.totals = { received: money(received), catalog_gross: money(catalog), gross_balance: money(received - catalog),
    received_percent: received ? "100.00" : null,
    catalog_gross_percent: received ? (catalog * 100 / received).toFixed(2) : null,
    gross_balance_percent: received ? ((received - catalog) * 100 / received).toFixed(2) : null };
}
export async function addManualCatalogEntry(id: string, input: { data: string; id_fonte: string; id_artista: string; valor: string; referencia: string; idempotency_key: string }): Promise<ReconciliationView> {
  const item = reconciliations.find((row) => row.id_conciliacao === id);
  const row = item?.rows.find((part) => part.id_fonte === input.id_fonte);
  if (!item || !row) throw new Error("Fonte demonstrativa não encontrada.");
  const artist = demoArtists.find((part) => part.id_artista === input.id_artista);
  if (!row.entries.some((entry) => entry.id === input.idempotency_key)) {
    row.entries.push({ id: input.idempotency_key, tipo: "MANUAL", origem: "Demonstração", referencia: input.referencia,
      valor: input.valor, data: input.data, id_artista: input.id_artista, nome_artista: artist?.nome_artista ?? "Artista Demo" });
  }
  recalculate(item); return copy(item);
}
export async function getArtists(signal?: AbortSignal): Promise<Artist[]> { aborted(signal); return copy(demoArtists); }

function preview(origin: string): IngestionPreview {
  return { arquivo: "catalogo_ficticio_demo.csv", origem: origin || "Demonstração", sha256: "mock-only-no-file-hash",
    linhas_totais: 2, linhas_validas: 1, linhas_bloqueadas: 1, warnings: 0, valor_total_valido: "125.00",
    fontes_afetadas: 1, artistas_afetados: 1, erros: [], pode_confirmar: true,
    linhas: [
      { linha: 2, data: `${demoPeriod}-19`, fonte: "Fonte Fictícia Aurora", artista: "Artista Demo A",
        valor: "125.00", situacao: "VALIDA", erros: [], avisos: [] },
      { linha: 3, data: "", fonte: "Fonte Fictícia Brisa", artista: "Artista Demo B",
        valor: "0.00", situacao: "BLOQUEADA", erros: ["Data fictícia ausente."], avisos: [] },
    ] };
}
export async function previewCatalogCsv(_id: string, _file: File, origin: string): Promise<IngestionPreview> { return preview(origin); }
export async function confirmCatalogCsv(id: string, _file: File, origin: string, expectedSha: string): Promise<{ batch_id: string; reconciliation: ReconciliationView }> {
  if (expectedSha !== "mock-only-no-file-hash") throw new Error("Prévia demonstrativa desatualizada.");
  const item = reconciliations.find((row) => row.id_conciliacao === id);
  const row = item?.rows.find((part) => part.id_fonte === "demo-source-a");
  if (!item || !row) throw new Error("Fonte demonstrativa indisponível nesta conciliação.");
  const entryId = nextId("entry");
  row.entries.push({ id: entryId, tipo: "IMPORTACAO", origem: origin || "Demonstração", referencia: "Exemplo importado",
    valor: "125.00", data: `${item.period}-19`, id_artista: "demo-artist-a", nome_artista: "Artista Demo A" });
  recalculate(item);
  const batch: IngestionBatchDetails = { id: nextId("batch"), tipo: "AUTOMATICA", origem: origin || "Demonstração",
    arquivo: "catalogo_ficticio_demo.csv", sha256: null, status: "CONCLUIDO", linhas: 1, valor_total: "125.00",
    importado_em: new Date().toISOString(), entries: [{ data: `${item.period}-19`, id_fonte: row.id_fonte, nome_fonte: row.nome_fonte,
      id_artista: "demo-artist-a", nome_artista: "Artista Demo A", valor: "125.00", origem: origin || "Demonstração", referencia: "Exemplo importado" }] };
  (batches[id] ??= []).unshift(batch);
  return { batch_id: batch.id, reconciliation: copy(item) };
}
export async function getIngestionBatches(id: string, signal?: AbortSignal): Promise<IngestionBatch[]> {
  aborted(signal); return copy((batches[id] ?? []).map(({ entries: _entries, ...item }) => item));
}
export async function getIngestionBatch(id: string, batchId: string, signal?: AbortSignal): Promise<IngestionBatchDetails> {
  aborted(signal); const item = (batches[id] ?? []).find((row) => row.id === batchId);
  if (!item) throw new Error("Lote demonstrativo não encontrado.");
  return copy(item);
}
