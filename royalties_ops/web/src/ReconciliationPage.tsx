import { useEffect, useState } from "react";
import { createReconciliation, getBankStatements, getReconciliation, getReconciliations } from "./api";
import type { BankStatementSummary, ReconciliationSummary, ReconciliationView, Source } from "./types";
import { money, monthLabel } from "./reconciliationFormat";
import ReconciliationOverviewPage from "./ReconciliationOverviewPage";
import ReconciliationOperationPage from "./ReconciliationOperationPage";
import ReconciliationImportPage from "./ReconciliationImportPage";
import type { HistorySearchTarget } from "./Spotlight";
import StatusNotice from "./StatusNotice";

export type ReconciliationSection = "overview" | "operation" | "import";
type Props = { section: ReconciliationSection; onSectionChange: (section: ReconciliationSection) => void;
  onReviewBankStatement: (id: string) => void;
  entity: "HM" | "MDB"; onEntityChange: (entity: "HM" | "MDB") => void; period: string; onPeriodChange: (period: string) => void;
  statementId: string; onStatementChange: (id: string) => void;
  selectedSourceId: string; onSelectedSourceChange: (id: string) => void;
  operationFilter: "all" | "action"; onOperationFilterChange: (filter: "all" | "action") => void;
  operationQuery: string; onOperationQueryChange: (query: string) => void; onOperationDraftDirtyChange: (dirty: boolean) => void;
  sources: Source[]; sourcesError: string; historyOpenRequest?: HistorySearchTarget & { key: number } };
const titles = { overview: "Visão geral", operation: "Operação", import: "Importar dados" };

export default function ReconciliationPage({ section, onSectionChange, onReviewBankStatement, entity, onEntityChange, period, onPeriodChange, statementId, onStatementChange, selectedSourceId, onSelectedSourceChange, operationFilter, onOperationFilterChange, operationQuery, onOperationQueryChange, onOperationDraftDirtyChange, sources, sourcesError, historyOpenRequest }: Props) {
  const [statements, setStatements] = useState<BankStatementSummary[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationSummary[]>([]);
  const [view, setView] = useState<ReconciliationView>();
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [importTab, setImportTab] = useState<"new" | "history">("new");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingContext, setPendingContext] = useState<{ kind: "entity"; value: "HM" | "MDB" } | { kind: "period" | "statement"; value: string }>();

  useEffect(() => {
    if (!historyOpenRequest) return;
    if (historyOpenRequest.entity !== entity || historyOpenRequest.period !== period) { onSelectedSourceChange(""); onStatementChange(""); onOperationFilterChange("all"); onOperationQueryChange(""); }
    onEntityChange(historyOpenRequest.entity);
    onPeriodChange(historyOpenRequest.period);
    setImportTab("history");
  }, [historyOpenRequest, onEntityChange, onPeriodChange, onSelectedSourceChange, onStatementChange, onOperationFilterChange, onOperationQueryChange]);

  useEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }, [section]);
  useEffect(() => { if (!previewOpen || section !== "import" || importTab !== "new") setPendingContext(undefined); }, [previewOpen, section, importTab]);

  useEffect(() => {
    const controller = new AbortController();
    setView(undefined); setReconciliations([]); setStatements([]);
    setError(""); setLoading(true);
    Promise.all([getBankStatements({ entity, period }, controller.signal), getReconciliations(entity, period, controller.signal)])
      .then(([saved, existing]) => {
        setStatements(saved); setReconciliations(existing);
        onStatementChange(saved.some((item) => item.id_extrato === statementId) ? statementId : saved.find((item) => item.is_current)?.id_extrato ?? saved[0]?.id_extrato ?? "");
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o período."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entity, period]);

  const existing = reconciliations.find((item) => item.bank_statement_id === statementId);
  const existingId = existing?.id_conciliacao;
  useEffect(() => {
    if (!existingId) { setView(undefined); setOpening(false); return; }
    const controller = new AbortController();
    setView(undefined); setError(""); setOpening(true);
    getReconciliation(existingId, controller.signal).then(setView)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível abrir a conciliação."); })
      .finally(() => { if (!controller.signal.aborted) setOpening(false); });
    return () => controller.abort();
  }, [existingId]);

  const selectedStatement = statements.find((item) => item.id_extrato === statementId);
  const begin = async () => {
    if (!statementId || existing) return;
    setError(""); setOpening(true);
    try {
      const created = await createReconciliation(statementId);
      setReconciliations((current) => [...current, created]); setView(created);
      setFeedback("Conciliação iniciada para esta versão do extrato.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a conciliação."); }
    finally { setOpening(false); }
  };
  const openSource = (id: string) => { onSelectedSourceChange(id); onSectionChange("operation"); };
  const importHistory = section === "import" && importTab === "history";
  const resetOperationList = () => { onOperationFilterChange("all"); onOperationQueryChange(""); };
  const requestEntityChange = (next: "HM" | "MDB") => {
    if (next === entity) return;
    if (section === "import" && importTab === "new" && previewOpen) setPendingContext({ kind: "entity", value: next });
    else { onSelectedSourceChange(""); onStatementChange(""); resetOperationList(); onEntityChange(next); }
  };
  const requestPeriodChange = (next: string) => {
    if (!next || next === period) return;
    if (section === "import" && importTab === "new" && previewOpen) setPendingContext({ kind: "period", value: next });
    else { onSelectedSourceChange(""); onStatementChange(""); resetOperationList(); onPeriodChange(next); }
  };
  const commitStatementChange = (next: string) => {
    onStatementChange(next); onSelectedSourceChange(""); resetOperationList(); setFeedback("");
  };
  const requestStatementChange = (next: string) => {
    if (next === statementId) return;
    if (section === "import" && importTab === "new" && previewOpen) setPendingContext({ kind: "statement", value: next });
    else commitStatementChange(next);
  };
  const applyPendingContext = () => {
    if (!pendingContext) return;
    onSelectedSourceChange("");
    resetOperationList();
    if (pendingContext.kind === "entity") { onStatementChange(""); onEntityChange(pendingContext.value); }
    else if (pendingContext.kind === "period") { onStatementChange(""); onPeriodChange(pendingContext.value); }
    else commitStatementChange(pendingContext.value);
    setPendingContext(undefined);
    setPreviewOpen(false);
  };
  const pendingStatement = pendingContext?.kind === "statement" ? statements.find((item) => item.id_extrato === pendingContext.value) : undefined;
  const pendingAction = pendingContext?.kind === "entity" ? `Trocar para a empresa ${pendingContext.value}`
    : pendingContext?.kind === "period" ? `Trocar para ${monthLabel(pendingContext.value)}`
      : pendingStatement ? `Trocar para o extrato v${pendingStatement.version} · ${pendingStatement.bank}` : "Remover o extrato selecionado";

  return <div className={`reconciliation-page reconciliation-page--${section}`}>
    <header className="reconciliation-page-heading"><h1>{section === "import" ? importTab === "history" ? "Histórico de importações" : "Nova importação" : titles[section]}</h1>{section !== "overview" && <p className="reconciliation-heading-context" aria-label="Contexto selecionado"><strong>{entity}{!importHistory && ` · ${monthLabel(period)}`}</strong>{section === "operation" && selectedStatement && <small>{selectedStatement.bank} · Extrato v{selectedStatement.version}</small>}</p>}</header>
    {importHistory ? <section className="reconciliation-context-picker reconciliation-context-picker--import-history" aria-label="Filtro do histórico"><div className="history-filters">
      <label>Empresa<select aria-label="Empresa do histórico" value={entity} onChange={(event) => onEntityChange(event.target.value as "HM" | "MDB")}><option value="MDB">MDB</option><option value="HM">HM</option></select></label>
    </div></section> : <section className="reconciliation-context-picker" aria-label="Contexto da conciliação"><details className="reconciliation-context-details" open={section === "overview" || section === "import" ? true : undefined}><summary>{section === "overview" || section === "import" ? "Contexto da conciliação" : "Alterar empresa, competência ou extrato"}</summary><div className="history-filters">
      <label>Empresa<select aria-label="Empresa da conciliação" value={entity} onChange={(event) => requestEntityChange(event.target.value as "HM" | "MDB")}><option value="MDB">MDB</option><option value="HM">HM</option></select></label>
      <label>Competência<input aria-label="Competência da conciliação" type="month" value={period} onChange={(event) => requestPeriodChange(event.target.value)} /></label>
      <label className="reconciliation-statement-select">Extrato / versão<select aria-label="Extrato e versão" value={statementId} onChange={(event) => requestStatementChange(event.target.value)}><option value="">Selecione um extrato</option>{statements.map((item) => <option key={item.id_extrato} value={item.id_extrato}>v{item.version}{item.is_current ? " · atual" : ""} · {item.bank} · {item.file_name}</option>)}</select></label>
    </div>{selectedStatement && <p className="source-help">{selectedStatement.displayed_count} transações · {money(selectedStatement.displayed_total)} · {existing ? "Conciliação existente" : "Conciliação ainda não iniciada"}</p>}</details>
      {!loading && !statements.length && <p className="source-help">Nenhum extrato salvo para esta empresa e competência.</p>}
      {section !== "overview" && selectedStatement && !existing && <button type="button" className="process" disabled={opening} onClick={begin}>{opening ? "Iniciando…" : "Iniciar conciliação"}</button>}
    </section>}
    {pendingContext && <div className="reconciliation-context-warning" role="alert"><div><strong>Prévia ainda não importada</strong><p>{pendingAction} descartará a prévia atual. Os lançamentos ainda não foram importados.</p></div><div className="reconciliation-context-warning-actions"><button type="button" onClick={() => setPendingContext(undefined)}>Ficar na prévia</button><button type="button" onClick={applyPendingContext}>Descartar prévia e trocar</button></div></div>}
    {!importHistory && (loading || opening && !view) ? <StatusNotice tone="loading">Carregando conciliação…</StatusNotice> : null}
    {!importHistory && error && <StatusNotice tone="error">{error}</StatusNotice>}
    {!importHistory && feedback && <StatusNotice tone="success">{feedback}</StatusNotice>}
    {section === "overview" && <ReconciliationOverviewPage view={view} onOpenSource={openSource} onReviewBankStatement={onReviewBankStatement} />}
    {section === "operation" && <ReconciliationOperationPage view={view} bank={selectedStatement?.bank} statementVersion={selectedStatement?.version} selectedSourceId={selectedSourceId} onSourceChange={onSelectedSourceChange} filter={operationFilter} onFilterChange={onOperationFilterChange} queueQuery={operationQuery} onQueueQueryChange={onOperationQueryChange} onDraftDirtyChange={onOperationDraftDirtyChange} onSaved={setView} />}
    {section === "import" && <ReconciliationImportPage view={view} entity={entity} tab={importTab} onTabChange={setImportTab} onConfirmed={setView} onOpenSource={openSource} onPreviewOpenChange={setPreviewOpen} openRequest={historyOpenRequest} />}
  </div>;
}
