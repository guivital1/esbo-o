import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { exportSavedBankStatement, getBankStatement, getBankStatements, importBankStatement,
  saveStatementAllocations, StatementVersionConflict } from "./api";
import { confirmAllocation, draftFor } from "./allocations";
import type { AllocationDraft } from "./allocations";
import type { BankStatementSummary, BankStatementView, Source, TransactionAllocation } from "./types";
import AllocationModal from "./AllocationModal";
import ReceiptSourceCell from "./ReceiptSourceCell";
import StatusNotice from "./StatusNotice";
import BankColumnFilters from "./BankColumnFilters";
import { availableSourceNames, emptyBankFilters, filterBankRows, hasBankFilters } from "./bankTableFilters";
import type { BankFilters } from "./bankTableFilters";
import { useRovingList } from "./useRovingList";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const monthLabel = (period: string) => { if (!period) return "Selecione a competência"; const value = month.format(asDate(`${period}-01`)); return `${value[0].toLocaleUpperCase("pt-BR")}${value.slice(1)}`; };
const banks = { MDB: "Safra", HM: "BTG Pactual" } as const;
const defaultPeriod = () => { const today = new Date(); const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1); return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`; };

type Props = { sources: Source[]; sourcesError: string; openRequest?: { statementId: string; transactionIndex?: number; key: number };
  returnToOperation?: { statementId: string; sourceId: string; filter: "all" | "action" | "mine" | "unidentified" };
  onReturnToOperation: () => void; onClearReturnContext: () => void; onAllocationSaved: (sourceIds: string[]) => void };

export default function BankStatementsPage({ sources, sourcesError, openRequest, returnToOperation, onReturnToOperation, onClearReturnContext, onAllocationSaved }: Props) {
  const [mode, setMode] = useState<"history" | "import" | "statement">("history");
  const [history, setHistory] = useState<BankStatementSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyEntity, setHistoryEntity] = useState("");
  const [historyBank, setHistoryBank] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [entity, setEntity] = useState<BankStatementView["entity"]>("MDB");
  const [period, setPeriod] = useState(defaultPeriod);
  const [file, setFile] = useState<File>();
  const [statement, setStatement] = useState<BankStatementView>();
  const [allocations, setAllocations] = useState<Record<number, TransactionAllocation>>({});
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<AllocationDraft[]>([]);
  const [search, setSearch] = useState("");
  const [bankFilters, setBankFilters] = useState<BankFilters>(emptyBankFilters);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [versionConflict, setVersionConflict] = useState("");
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [allocationError, setAllocationError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const modeInitialized = useRef(false);

  useEffect(() => {
    if (!modeInitialized.current) { modeInitialized.current = true; return; }
    requestAnimationFrame(() => {
      if (document.querySelector('.allocation-modal[aria-modal="true"]')) return;
      const target = mode === "history" ? ".history-filters select" : ".bank-page .back-history";
      document.querySelector<HTMLElement>(target)?.focus();
    });
  }, [mode]);

  const refreshHistory = () => getBankStatements({ entity: historyEntity || undefined, bank: historyBank || undefined,
    period: historyPeriod || undefined }).then(setHistory);
  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    getBankStatements({ entity: historyEntity || undefined, bank: historyBank || undefined,
      period: historyPeriod || undefined }, controller.signal).then(setHistory)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => { controller.abort(); request.current?.abort(); };
  }, [historyEntity, historyBank, historyPeriod]);

  useEffect(() => {
    if (!openRequest) return;
    let active = true;
    setError(""); setFeedback("");
    getBankStatement(openRequest.statementId).then((saved) => {
      if (!active) return;
      const savedAllocations = saved.allocations ?? {};
      const requestedIndex = openRequest.transactionIndex;
      const requestedPending = requestedIndex !== undefined && saved.rows[requestedIndex]?.review_required && !savedAllocations[requestedIndex];
      const pendingIndex = requestedPending ? requestedIndex : saved.rows.findIndex((row, index) => row.review_required && !savedAllocations[index]);
      setStatement(saved); setAllocations(savedAllocations); setSearch(""); setBankFilters(emptyBankFilters());
      setActiveIndex(pendingIndex >= 0 ? pendingIndex : null);
      if (pendingIndex >= 0) setDraft(draftFor(saved.rows[pendingIndex], savedAllocations[pendingIndex], sources));
      else setFeedback("Este extrato não tem recebimentos sem fonte para analisar.");
      setMode("statement");
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível abrir o extrato."); });
    return () => { active = false; };
  }, [openRequest]);

  const openSaved = async (id: string) => {
    onClearReturnContext();
    setError(""); setFeedback("");
    try {
      const saved = await getBankStatement(id);
      setStatement(saved); setAllocations(saved.allocations ?? {}); setSearch(""); setBankFilters(emptyBankFilters());
      setActiveIndex(null); setMode("statement");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir o extrato."); }
  };
  const showHistory = () => {
    onClearReturnContext();
    request.current?.abort(); request.current = null;
    setMode("history"); setStatement(undefined); setActiveIndex(null); setFile(undefined);
    setError(""); setFeedback(""); setVersionConflict("");
    refreshHistory().catch(() => setError("Não foi possível atualizar o histórico."));
  };
  const showImport = () => {
    onClearReturnContext();
    setMode("import"); setStatement(undefined); setAllocations({}); setFile(undefined);
    setError(""); setFeedback(""); setVersionConflict("");
    if (input.current) input.current.value = "";
  };
  const selectFile = (selected?: File) => {
    setFile(undefined); setVersionConflict(""); setError("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".pdf")) { setError("Selecione um arquivo PDF de extrato."); return; }
    setFile(selected);
  };
  const process = async (event?: FormEvent, expectedCurrentId?: string) => {
    event?.preventDefault();
    if (!file) { setError("Selecione um PDF de extrato para continuar."); return; }
    request.current?.abort(); const current = new AbortController(); request.current = current;
    setError(""); setProcessing(true);
    try {
      const saved = await importBankStatement({ entity, period, file },
        expectedCurrentId ? { expectedCurrentId } : {}, current.signal);
      if (request.current !== current || current.signal.aborted) return;
      setStatement(saved); setAllocations(saved.allocations ?? {}); setSearch(""); setBankFilters(emptyBankFilters());
      setVersionConflict(""); setMode("statement");
      setFeedback(saved.already_imported ? "Este arquivo já estava no histórico. Abrimos o extrato existente." : "Extrato importado e salvo.");
      refreshHistory().catch(() => { /* A resposta do POST contém o estado salvo. */ });
    } catch (reason) {
      if (request.current !== current || current.signal.aborted) return;
      if (reason instanceof StatementVersionConflict) { setVersionConflict(reason.currentStatementId); setError(reason.message); }
      else setError(reason instanceof Error ? reason.message : "Não foi possível importar o extrato.");
    } finally { if (request.current === current) { setProcessing(false); request.current = null; } }
  };
  const exportXlsx = async () => {
    if (!statement?.id_extrato) return;
    setError(""); setExporting(true);
    try { await exportSavedBankStatement(statement.id_extrato); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível exportar o extrato."); }
    finally { setExporting(false); }
  };
  const openRow = (index: number) => {
    setActiveIndex(index); setAllocationError("");
    if (statement) setDraft(draftFor(statement.rows[index], allocations[index], sources));
  };
  const changeDraft = (index: number, patch: Partial<AllocationDraft>) => setDraft((current) => current.map((item, at) => at === index ? { ...item, ...patch } : item));
  const confirm = async (index: number) => {
    if (!statement?.id_extrato || !statement.rows[index].id_transacao) return;
    const allocation = confirmAllocation(index, statement.rows[index], draft, sources);
    if (!allocation) return;
    setSavingAllocation(true); setAllocationError("");
    try {
      const saved = await saveStatementAllocations(statement.id_extrato, statement.rows[index].id_transacao!, allocation.allocations);
      setStatement(saved); setAllocations(saved.allocations ?? {}); setActiveIndex(null);
      setFeedback("Desdobramento salvo no histórico.");
      onAllocationSaved(allocation.allocations.map((part) => part.id_fonte));
      refreshHistory().catch(() => { /* A resposta contém o estado salvo. */ });
    } catch (reason) { setAllocationError(reason instanceof Error ? reason.message : "Não foi possível salvar o desdobramento."); }
    finally { setSavingAllocation(false); }
  };

  const visibleHistory = useMemo(() => history.filter((item) =>
    `${monthLabel(item.period)} ${item.entity} ${item.bank} ${item.file_name}`.toLocaleLowerCase("pt-BR")
      .includes(historySearch.trim().toLocaleLowerCase("pt-BR"))), [history, historySearch]);
  const rows = useMemo(() => statement ? filterBankRows(statement, allocations, sources, bankFilters, search) : [],
    [search, statement, allocations, sources, bankFilters]);
  const historyKeyboard = useRovingList(visibleHistory.map((item) => item.id_extrato));
  const receiptsKeyboard = useRovingList(rows.map(({ row, index }) => row.id_transacao ?? String(index)));
  const sourceOptions = useMemo(() => availableSourceNames(statement?.rows ?? [], allocations, sources), [statement, allocations, sources]);
  const pending = statement?.rows.reduce((count, row, index) => count + Number(row.review_required && !allocations[index]), 0) ?? 0;

  return <div className="bank-page">
    <section className="page-heading bank-heading"><div><p className="eyebrow">IMPORTAÇÕES · EXTRATOS BANCÁRIOS</p><h1>{mode === "statement" ? monthLabel(statement!.period) : mode === "import" ? "Importar extrato" : "Histórico de extratos"}</h1></div>
      {mode !== "import" && <div className="bank-actions"><button type="button" className="process" onClick={showImport}>+ Importar extrato</button></div>}
    </section>
    {mode === "import" && <button type="button" className="text-button back-history" onClick={showHistory}>← Voltar ao histórico</button>}
    {mode === "history" && <>
      <div className="history-filters"><label>Empresa<select aria-label="Filtrar empresa" value={historyEntity} onChange={(event) => setHistoryEntity(event.target.value)}><option value="">Todas</option><option value="HM">HM</option><option value="MDB">MDB</option></select></label>
        <label>Banco<select aria-label="Filtrar banco" value={historyBank} onChange={(event) => setHistoryBank(event.target.value)}><option value="">Todos</option><option value="BTG">BTG Pactual</option><option value="SAFRA">Safra</option></select></label>
        <label>Competência<input aria-label="Filtrar competência" type="month" value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value)} /></label>
        <label className="history-search">Buscar<input aria-label="Buscar histórico" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Arquivo ou período" /></label></div>
      {error && <StatusNotice tone="error">{error}</StatusNotice>}
      <section className="table-section"><div className="table-toolbar"><div><h2>Extratos salvos</h2><p>{visibleHistory.length} registro(s) no histórico</p></div></div>
        {historyLoading ? <StatusNotice tone="loading" className="bank-history-notice">Carregando histórico…</StatusNotice> : visibleHistory.length === 0 ? <p className="empty">Nenhum extrato encontrado. Use “+ Importar extrato” para começar.</p> :
          <div className="table-wrap"><table className="history-table"><thead><tr><th>Competência</th><th>Empresa</th><th>Banco</th><th>Movimentos</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody onKeyDown={historyKeyboard.onKeyDown}>{visibleHistory.map((item) =>
            <tr key={item.id_extrato}><td>{monthLabel(item.period)}</td><td>{item.entity}</td><td>{item.bank}</td><td>{item.displayed_count}</td><td className="amount">{money.format(Number(item.displayed_total))}</td><td><span className={`source-status ${item.status === "validated" ? "is-active" : "is-pending"}`}>{item.status_label}</span></td><td><button className="source-action" type="button" {...historyKeyboard.itemProps(item.id_extrato)} aria-label={`Abrir extrato de ${monthLabel(item.period)} · ${item.entity} · ${item.bank}`} onClick={() => openSaved(item.id_extrato)}>Abrir</button></td></tr>)}</tbody></table></div>}
      </section></>}
    {mode === "import" && <><header className="context-bar"><label>Empresa<select value={entity} aria-label="Empresa" onChange={(event) => { setEntity(event.target.value as BankStatementView["entity"]); setVersionConflict(""); }}><option value="MDB">MDB</option><option value="HM">HM</option></select></label><span className="context-divider" /><div><small>Banco</small><strong>{banks[entity]}</strong></div><span className="context-divider" /><label>Competência<input type="month" value={period} required onChange={(event) => { setPeriod(event.target.value); setVersionConflict(""); }} aria-label="Competência" /></label></header>
      <form className="upload-panel" onSubmit={(event) => process(event)}><div className="upload-copy"><span className="upload-icon">↑</span><div><h2>Enviar extrato {banks[entity]}</h2><p>Selecione o PDF de {monthLabel(period)}.</p></div></div><div className="drop-zone" onDragOver={(event: DragEvent) => event.preventDefault()} onDrop={(event: DragEvent) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}><strong>{file ? file.name : "Selecione ou arraste um PDF"}</strong><span>{file ? "Arquivo pronto para importação" : "Somente arquivos PDF"}</span><input ref={input} type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0])} /></div><button type="button" className="source-action" onClick={() => selectFile(new File([], "extrato_ficticio_demo.pdf", { type: "application/pdf" }))}>Usar extrato fictício</button>{error && <StatusNotice tone="error">{error}</StatusNotice>}{versionConflict && <div className="version-confirm"><p>A versão atual será preservada no histórico. Confirme se deseja criar uma nova versão deste mês.</p><button type="button" className="source-action" onClick={() => setVersionConflict("")}>Cancelar</button><button type="button" className="process" disabled={processing} onClick={() => process(undefined, versionConflict)}>Criar nova versão</button></div>}{!versionConflict && <button className="process" type="submit" disabled={processing || !period}>{processing ? "Importando extrato…" : "Importar e salvar extrato"}</button>}</form></>}
    {mode === "statement" && statement && <>
      <div className="bank-statement-navigation"><button type="button" className="text-button back-history" onClick={showHistory}>← Voltar ao histórico</button>
        {returnToOperation && returnToOperation.statementId === statement.id_extrato && <div className="bank-return-context"><span>{returnToOperation.sourceId ? `Fonte: ${sources.find((source) => source.id_fonte === returnToOperation.sourceId)?.nome_fonte ?? "identificada"}` : "Conferência iniciada na conciliação"} · {({ all: "Todas", action: "Precisam de ação", mine: "Minhas pendências", unidentified: "Sem fonte" } as const)[returnToOperation.filter]}</span><button type="button" onClick={onReturnToOperation}>Voltar à Operação <span aria-hidden="true">→</span></button></div>}</div>
      {feedback && <StatusNotice tone="success">{feedback}</StatusNotice>}{error && <StatusNotice tone="error">{error}</StatusNotice>}
      <section className="file-card" aria-label="Extrato salvo"><div className="file-icon">PDF</div><div className="file-meta"><strong>{statement.file_name}</strong><span>{statement.entity} · {statement.bank} · v{statement.version}{statement.is_current ? " · versão atual" : " · versão anterior"}</span>{statement.statement_period_start && statement.statement_period_end && <span>Período: {date.format(asDate(statement.statement_period_start))} — {date.format(asDate(statement.statement_period_end))}</span>}</div><span className={`status ${pending ? "review" : "validated"}`}>{pending ? "Com pendências" : "Validado"}</span><button className="export" type="button" onClick={exportXlsx} disabled={exporting} title="Exporta todos os movimentos salvos, sem os filtros visuais.">{exporting ? "Exportando XLSX…" : "Exportar XLSX"}</button></section>
      <section className="summary" aria-label="Resumo operacional"><article><strong>{money.format(Number(statement.displayed_total))}</strong><span>Valor total</span></article><article><strong>{statement.displayed_count}</strong><span>Transações</span></article><article><strong>{pending}</strong><span>Pendências</span></article></section>
      <section className="table-section"><div className="table-toolbar"><div><h2>Recebimentos</h2><p>{rows.length} de {statement.rows.length} linhas visíveis</p></div><div className="bank-table-search"><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição ou fonte" aria-label="Buscar recebimentos" /></label>{hasBankFilters(bankFilters, search) && <button type="button" className="clear-bank-filters" onClick={() => { setSearch(""); setBankFilters(emptyBankFilters()); }}>Limpar filtros</button>}</div></div><div className="table-wrap"><table><thead><BankColumnFilters filters={bankFilters} onChange={(patch) => setBankFilters((current) => ({ ...current, ...patch }))} sourceOptions={sourceOptions} /></thead><tbody onKeyDown={receiptsKeyboard.onKeyDown}>{rows.map(({ row, index }) => <tr key={row.id_transacao ?? index}><td>{date.format(asDate(row.date))}</td><td>{row.description}</td><ReceiptSourceCell row={row} allocation={allocations[index]} sources={sources} transactionIndex={index} keyboardProps={receiptsKeyboard.itemProps(row.id_transacao ?? String(index))} onOpen={() => openRow(index)} /><td className="amount">{money.format(Number(row.amount))}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="empty">Nenhum recebimento encontrado.</p>}</div></section><p className="session-note">Desdobramentos são salvos no histórico. O XLSX preserva os movimentos originais do extrato.</p></>}
    {mode === "statement" && statement && activeIndex !== null && <AllocationModal row={statement.rows[activeIndex]} draft={draft} sources={sources} sourcesError={allocationError || sourcesError} saving={savingAllocation} onChange={changeDraft} onAdd={() => setDraft((current) => [...current, { id_fonte: "", amount: "" }])} onRemove={(index) => setDraft((current) => current.filter((_, position) => position !== index))} onCancel={() => setActiveIndex(null)} onConfirm={() => confirm(activeIndex)} />}
  </div>;
}
