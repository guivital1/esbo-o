import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addManualCatalogEntry, getArtists } from "./api";
import type { Artist, BankStatementView, CatalogEntry, ReconciliationRow, ReconciliationView } from "./types";
import { cents, money, moneyFromCents, monthLabel, percent, sourceNumber } from "./reconciliationFormat";
import StatusNotice from "./StatusNotice";
import type { SavedOperationView, SessionAction, SessionNote } from "./sessionNotes";
import { onTabArrowKey } from "./keyboardTabs";

export type ArtistComposition = { key: string; nome: string; valorCents: bigint; lancamentos: number; identificada: boolean };

export function composeByArtist(entries: CatalogEntry[]): ArtistComposition[] {
  const groups = new Map<string, ArtistComposition>();
  for (const entry of entries) {
    const key = entry.id_artista || `legacy:${entry.id}`;
    const group = groups.get(key) ?? { key, nome: entry.nome_artista || "Artista não identificado", valorCents: 0n,
      lancamentos: 0, identificada: Boolean(entry.id_artista) };
    group.valorCents += cents(entry.valor);
    group.lancamentos += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

type QueueStatus = "pending" | "balanced" | "review";
type QueueFilter = SavedOperationView["filter"];

function hasMovement(row: ReconciliationRow): boolean {
  return cents(row.recebido) !== 0n || cents(row.catalogo_bruto) !== 0n || cents(row.saldo_bruto) !== 0n;
}

function queueStatus(row: ReconciliationRow): QueueStatus {
  const balance = cents(row.saldo_bruto);
  if (balance < 0n) return "review";
  return balance > 0n ? "pending" : "balanced";
}
function absoluteBalance(row: ReconciliationRow): bigint {
  const value = cents(row.saldo_bruto);
  return value < 0n ? -value : value;
}

function manualAmountCents(value: string): bigint | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fractional = ""] = normalized.split(".");
  const parsed = BigInt(whole) * 100n + BigInt(fractional.padEnd(2, "0"));
  return parsed > 0n ? parsed : null;
}

const statusLabel: Record<QueueStatus, string> = {
  pending: "A conciliar", balanced: "Conciliada", review: "Revisar saldo",
};
const statusOrder: Record<QueueStatus, number> = { review: 0, pending: 1, balanced: 2 };
const demoActivity: Record<string, { action: string; actor: string; day: string; time: string; changes?: SessionAction["changes"] }[]> = {
  "demo-source-a": [
    { action: "Importou lote de lançamentos", actor: "Operador Demo A", day: "28", time: "10:00",
      changes: [{ field: "Conciliado", before: "R$ 0,00", after: "R$ 1.200,00" }] },
    { action: "Conferiu identificação da fonte", actor: "Operador Demo B", day: "24", time: "14:18" },
  ],
  "demo-source-b": [
    { action: "Importou lote de lançamentos", actor: "Operador Demo A", day: "28", time: "10:00",
      changes: [{ field: "Conciliado", before: "R$ 0,00", after: "R$ 700,00" }] },
  ],
};

type Props = { view?: ReconciliationView; statement?: BankStatementView; bank?: string; statementVersion?: number; selectedSourceId: string;
  onSourceChange: (id: string) => void; filter: QueueFilter; onFilterChange: (filter: QueueFilter) => void;
  queueQuery: string; onQueueQueryChange: (query: string) => void; onDraftDirtyChange: (dirty: boolean) => void;
  savedViews: SavedOperationView[]; onSaveView: (view: SavedOperationView) => void; onDeleteView: (id: string) => void;
  sessionNotes: SessionNote[]; sessionActions: SessionAction[];
  onReviewBankStatement: (id: string, transactionIndex?: number) => void;
  onAddSessionAction: (action: SessionAction) => void;
  onSaved: (view: ReconciliationView) => void };

export default function ReconciliationOperationPage({ view, statement, bank, statementVersion, selectedSourceId, onSourceChange, filter, onFilterChange, queueQuery, onQueueQueryChange, savedViews, onSaveView, onDeleteView, sessionNotes, sessionActions, onDraftDirtyChange, onReviewBankStatement, onAddSessionAction, onSaved }: Props) {
  const [detailOpen, setDetailOpen] = useState(() => Boolean(selectedSourceId && view?.rows.some((item) => item.id_fonte === selectedSourceId && hasMovement(item))));
  const [mode, setMode] = useState<"artists" | "entries">("artists");
  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistsError, setArtistsError] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [artistId, setArtistId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activeRowKey, setActiveRowKey] = useState("");
  const [pendingManualExit, setPendingManualExit] = useState<"manual" | "detail" | null>(null);
  const [viewName, setViewName] = useState("");
  const [savingView, setSavingView] = useState(false);
  const [viewFeedback, setViewFeedback] = useState("");
  const [expandedDivergence, setExpandedDivergence] = useState<"review" | "pending" | "unidentified" | null>(null);
  const submissionKey = useRef(crypto.randomUUID());
  const dateInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const manualWarningContinue = useRef<HTMLButtonElement>(null);
  const saveViewTrigger = useRef<HTMLButtonElement>(null);
  const restoredSelection = useRef(false);
  const manualDraftDirty = manualOpen && Boolean(entryDate || artistId || amount.trim() || reference.trim());
  useEffect(() => { onDraftDirtyChange(manualDraftDirty); }, [manualDraftDirty, onDraftDirtyChange]);
  useEffect(() => () => onDraftDirtyChange(false), [onDraftDirtyChange]);

  const queue = useMemo(() => {
    return (view?.rows ?? []).filter(hasMovement).sort((a, b) => {
      const statusDifference = statusOrder[queueStatus(a)] - statusOrder[queueStatus(b)];
      if (statusDifference) return statusDifference;
      const balanceA = absoluteBalance(a), balanceB = absoluteBalance(b);
      if (balanceA !== balanceB) return balanceA > balanceB ? -1 : 1;
      return (a.numero_fonte ?? Number.MAX_SAFE_INTEGER) - (b.numero_fonte ?? Number.MAX_SAFE_INTEGER);
    });
  }, [view]);
  const actionRows = queue.filter((item) => queueStatus(item) !== "balanced");
  const mineRows = actionRows.filter((item) => item.assignee === "Guilherme Vital");
  const unidentifiedRows = statement?.rows.map((item, index) => ({ item, index }))
    .filter(({ item, index }) => item.review_required && !statement.allocations?.[index]) ?? [];
  const pendingTotal = actionRows.reduce((total, item) => total + (cents(item.saldo_bruto) > 0n ? cents(item.saldo_bruto) : 0n), 0n);
  const reviewCount = actionRows.filter((item) => queueStatus(item) === "review").length;
  const excessRows = actionRows.filter((item) => queueStatus(item) === "review");
  const pendingRows = actionRows.filter((item) => queueStatus(item) === "pending");
  const excessTotal = excessRows.reduce((total, item) => total + absoluteBalance(item), 0n);
  const unidentifiedTotal = unidentifiedRows.reduce((total, { item }) => total + cents(item.amount), 0n);
  const queueTerm = queueQuery.trim().toLocaleLowerCase("pt-BR");
  const visibleQueue = queue.filter((item) => (filter === "all" || (filter === "action" && queueStatus(item) !== "balanced") || (filter === "mine" && item.assignee === "Guilherme Vital" && queueStatus(item) !== "balanced")) &&
    `${item.nome_fonte} ${sourceNumber(item.numero_fonte)}`.toLocaleLowerCase("pt-BR").includes(queueTerm));
  const visibleUnidentified = unidentifiedRows.filter(({ item }) => `${item.description} ${item.date}`.toLocaleLowerCase("pt-BR").includes(queueTerm));
  const visibleRowKeys = filter === "unidentified"
    ? visibleUnidentified.map(({ item, index }) => `receipt:${item.id_transacao ?? index}`)
    : visibleQueue.map((item) => `source:${item.id_fonte}`);
  const keyboardActiveRowKey = visibleRowKeys.includes(activeRowKey) ? activeRowKey
    : visibleRowKeys.includes(`source:${selectedSourceId}`) ? `source:${selectedSourceId}` : visibleRowKeys[0];
  const sourceId = queue.some((item) => item.id_fonte === selectedSourceId) ? selectedSourceId : queue[0]?.id_fonte || "";
  const row = queue.find((item) => item.id_fonte === sourceId);
  const nextSource = queue[queue.findIndex((item) => item.id_fonte === sourceId) + 1];
  const entries = row?.entries ?? [];
  const sourceReceipts = statement?.rows.flatMap((item, index) => {
    const parts = statement.allocations?.[index]?.allocations;
    const allocation = parts?.find((part) => part.id_fonte === sourceId);
    if (parts ? !allocation : item.id_fonte !== sourceId) return [];
    return [{ key: item.id_transacao ?? String(index), date: item.date, description: item.description,
      amount: allocation ? moneyFromCents(BigInt(allocation.amount_cents)) : money(item.amount) }];
  }) ?? [];
  const groups = useMemo(() => composeByArtist(entries), [entries]);
  const identifiedArtistCount = groups.filter((item) => item.identificada).length;
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const filteredGroups = groups.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(term));
  const filteredEntries = entries.filter((item) => `${item.nome_artista ?? ""} ${item.origem} ${item.referencia}`.toLocaleLowerCase("pt-BR").includes(term));
  const receivedCents = cents(row?.recebido ?? "0.00");
  const enteredCents = manualAmountCents(amount);
  const projectedConciliated = enteredCents === null ? null : cents(row?.catalogo_bruto ?? "0.00") + enteredCents;
  const projectedPending = projectedConciliated === null ? null : receivedCents - projectedConciliated;
  const sourceAudit = view ? [
    ...sessionActions.filter((action) => action.reconciliationId === view.id_conciliacao && action.sourceId === sourceId)
      .map((action) => ({ id: action.id, title: action.title, detail: action.detail, actor: action.actor, at: action.createdAt, changes: action.changes ?? [], demo: false })),
    ...sessionNotes.filter((note) => note.reconciliationId === view.id_conciliacao && note.sourceId === sourceId)
      .map((note) => ({ id: note.id, title: "Observação registrada", detail: note.text, actor: `${note.author} · ${note.role}`, at: note.createdAt, changes: [], demo: false })),
    ...(demoActivity[sourceId] ?? []).map((item, index) => ({ id: `demo-${sourceId}-${index}`, title: item.action,
      detail: "Registro fictício da competência", actor: item.actor, at: `${view.period}-${item.day}T${item.time}:00`, changes: item.changes ?? [], demo: true })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  const auditDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const metricPercent = (value: string) => {
    if (receivedCents === 0n) return "—";
    const scaled = (cents(value) * 10000n + receivedCents / 2n) / receivedCents;
    return percent(`${scaled / 100n}.${String(scaled % 100n).padStart(2, "0")}`);
  };

  const closeDetail = () => {
    if (saving) return;
    if (manualDraftDirty) { setPendingManualExit("detail"); return; }
    setManualOpen(false);
    setDetailOpen(false);
    requestAnimationFrame(restoreSourceFocus);
  };
  const closeManual = () => {
    if (saving) return;
    if (manualDraftDirty) { setPendingManualExit("manual"); return; }
    setManualOpen(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };
  const discardManual = () => {
    const closeDrawer = pendingManualExit === "detail";
    setEntryDate(""); setArtistId(""); setAmount(""); setReference(""); setPendingManualExit(null); setManualOpen(false);
    if (closeDrawer) { setDetailOpen(false); requestAnimationFrame(restoreSourceFocus); }
    else requestAnimationFrame(() => addButton.current?.focus());
  };
  const restoreSourceFocus = () => {
    if (trigger.current?.isConnected) { trigger.current.focus(); return; }
    const sourceButton = [...document.querySelectorAll<HTMLButtonElement>(".operation-source-row[data-source-id]")]
      .find((button) => button.dataset.sourceId === sourceId);
    (sourceButton ?? document.querySelector<HTMLButtonElement>(".operation-priority button"))?.focus();
  };
  const selectSource = (id: string) => {
    onSourceChange(id);
    setSearch("");
    setFeedback("");
    setDetailOpen(true);
  };
  const moveRowFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>(".operation-source-row");
    if (!current || !event.currentTarget.contains(current)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".operation-source-row")];
    if (!buttons.length) return;
    const index = buttons.indexOf(current);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : Math.min(buttons.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    const next = buttons[nextIndex];
    setActiveRowKey(next.dataset.rowKey ?? "");
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  };

  useEffect(() => {
    if (restoredSelection.current || !view) return;
    restoredSelection.current = true;
    if (selectedSourceId && view.rows.some((item) => item.id_fonte === selectedSourceId && hasMovement(item))) setDetailOpen(true);
  }, [view, selectedSourceId]);

  useEffect(() => {
    if (!detailOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [detailOpen]);
  useEffect(() => {
    if (!detailOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"][aria-modal="true"]')) return;
      if (event.key === "Escape") { event.preventDefault(); if (pendingManualExit) { setPendingManualExit(null); requestAnimationFrame(() => dateInput.current?.focus()); } else if (manualOpen) closeManual(); else closeDetail(); return; }
      if (event.key !== "Tab" || !drawer.current) return;
      const focusable = [...drawer.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (!drawer.current.contains(document.activeElement) || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (!drawer.current.contains(document.activeElement) || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, manualOpen, manualDraftDirty, pendingManualExit, saving, sourceId]);
  useEffect(() => {
    if (!manualOpen) return;
    dateInput.current?.focus();
    const controller = new AbortController();
    getArtists(controller.signal).then(setArtists).catch((reason) => {
      if (!controller.signal.aborted) setArtistsError(reason instanceof Error ? reason.message : "Não foi possível carregar os artistas.");
    });
    return () => controller.abort();
  }, [manualOpen]);
  useEffect(() => { if (pendingManualExit) manualWarningContinue.current?.focus(); }, [pendingManualExit]);

  const saveManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!view || !sourceId || enteredCents === null) return;
    const normalizedAmount = `${enteredCents / 100n}.${String(enteredCents % 100n).padStart(2, "0")}`;
    setError(""); setSaving(true);
    try {
      const saved = await addManualCatalogEntry(view.id_conciliacao, { data: entryDate, id_fonte: sourceId,
        id_artista: artistId, valor: normalizedAmount, referencia: reference.trim(),
        idempotency_key: submissionKey.current });
      onSaved(saved);
      onAddSessionAction({ id: crypto.randomUUID(), reconciliationId: view.id_conciliacao, sourceId,
        title: "Lançamento manual adicionado", detail: `${row?.nome_fonte ?? "Fonte"} · ${money(normalizedAmount)} · ${reference.trim()}`,
        actor: "Guilherme Vital · Estagiário de Backoffice", createdAt: new Date().toISOString(),
        changes: [
          { field: "Conciliado", before: money(row?.catalogo_bruto ?? "0"), after: moneyFromCents(projectedConciliated ?? 0n) },
          { field: "A conciliar", before: money(row?.saldo_bruto ?? "0"), after: moneyFromCents(projectedPending ?? 0n) },
        ] });
      setPendingManualExit(null); setManualOpen(false); setEntryDate(""); setArtistId(""); setAmount(""); setReference("");
      submissionKey.current = crypto.randomUUID();
      const warnings = (saved as ReconciliationView & { ingestion_warnings?: string[] }).ingestion_warnings ?? [];
      setFeedback(`Lançamento salvo. Conciliado e A conciliar foram atualizados.${warnings.length ? ` ${warnings.join(" ")}` : ""}`);
      requestAnimationFrame(() => addButton.current?.focus());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o lançamento."); }
    finally { setSaving(false); }
  };

  if (!view) return <p className="reconciliation-empty">Selecione ou inicie uma conciliação para trabalhar por fonte pagadora.</p>;

  const filters: { key: QueueFilter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: queue.length },
    { key: "action", label: "Precisam de ação", count: actionRows.length },
    { key: "mine", label: "Minhas pendências", count: mineRows.length },
    { key: "unidentified", label: "Sem fonte", count: unidentifiedRows.length },
  ];
  const saveCurrentView = (event: FormEvent) => {
    event.preventDefault();
    const name = viewName.trim();
    if (!name) return;
    if (savedViews.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      setViewFeedback("Já existe uma visão com esse nome."); return;
    }
    onSaveView({ id: crypto.randomUUID(), name, filter, query: queueQuery.trim() });
    setSavingView(false); setViewName(""); setViewFeedback(`Visão “${name}” salva nesta sessão.`);
    requestAnimationFrame(() => saveViewTrigger.current?.focus());
  };
  const applySavedView = (saved: SavedOperationView) => {
    onFilterChange(saved.filter); onQueueQueryChange(saved.query);
    setViewFeedback(`Visão “${saved.name}” aplicada.`);
  };

  return <div className="reconciliation-operation" aria-label="Operação da conciliação">
    <section className="operation-priority" aria-label="Prioridade da conciliação"><div><span>FILA DA COMPETÊNCIA</span><strong>{actionRows.length ? `${actionRows.length} ${actionRows.length === 1 ? "fonte precisa" : "fontes precisam"} de ação` : "Todas as fontes conciliadas"}</strong><p>{actionRows.length ? `${moneyFromCents(pendingTotal)} a conciliar${reviewCount ? ` · ${reviewCount} ${reviewCount === 1 ? "saldo para revisar" : "saldos para revisar"}` : ""}` : "Nenhuma diferença entre recebido e conciliado nas fontes com movimento."}</p></div>{actionRows[0] && <button type="button" onClick={(event) => { trigger.current = event.currentTarget; selectSource(actionRows[0].id_fonte); }}><span>PRÓXIMA FONTE</span><strong>{actionRows[0].nome_fonte}</strong><small>{queueStatus(actionRows[0]) === "review" ? "Revisar saldo" : `${money(actionRows[0].saldo_bruto)} a conciliar`} <span aria-hidden="true">↗</span></small></button>}</section>
    <section className="operation-divergences" aria-label="Fila de divergências"><header><div><h2>Fila de divergências</h2><p>Separe o que precisa de conferência pelo motivo da diferença.</p></div><span>{pendingRows.length + excessRows.length + unidentifiedRows.length} itens</span></header>
      {pendingRows.length + excessRows.length + unidentifiedRows.length === 0 ? <p className="operation-divergences-empty">Nenhuma divergência nesta competência.</p> : <div className="operation-divergence-groups">
        {excessRows.length > 0 && <div className="operation-divergence-group"><h3>Catálogo acima do recebido <small>{excessRows.length} · {moneyFromCents(excessTotal)}</small></h3>{(expandedDivergence === "review" ? excessRows : excessRows.slice(0, 3)).map((item) => <button key={item.id_fonte} type="button" onClick={(event) => { trigger.current = event.currentTarget; selectSource(item.id_fonte); }}><span><strong>{item.nome_fonte}</strong><small>Revisar lançamentos e composição</small></span><b>{moneyFromCents(absoluteBalance(item))}</b><span aria-hidden="true">↗</span></button>)}{excessRows.length > 3 && <button className="operation-divergence-expand" type="button" aria-expanded={expandedDivergence === "review"} onClick={() => setExpandedDivergence(expandedDivergence === "review" ? null : "review")}>{expandedDivergence === "review" ? "Mostrar menos" : `Ver todas as ${excessRows.length} fontes`}</button>}</div>}
        {pendingRows.length > 0 && <div className="operation-divergence-group"><h3>Recebido ainda não conciliado <small>{pendingRows.length} · {moneyFromCents(pendingTotal)}</small></h3>{(expandedDivergence === "pending" ? pendingRows : pendingRows.slice(0, 3)).map((item) => <button key={item.id_fonte} type="button" onClick={(event) => { trigger.current = event.currentTarget; selectSource(item.id_fonte); }}><span><strong>{item.nome_fonte}</strong><small>Conferir extrato e catálogo</small></span><b>{money(item.saldo_bruto)}</b><span aria-hidden="true">↗</span></button>)}{pendingRows.length > 3 && <button className="operation-divergence-expand" type="button" aria-expanded={expandedDivergence === "pending"} onClick={() => setExpandedDivergence(expandedDivergence === "pending" ? null : "pending")}>{expandedDivergence === "pending" ? "Mostrar menos" : `Ver todas as ${pendingRows.length} fontes`}</button>}</div>}
        {unidentifiedRows.length > 0 && <div className="operation-divergence-group"><h3>Recebimentos sem fonte <small>{unidentifiedRows.length} · {moneyFromCents(unidentifiedTotal)}</small></h3>{(expandedDivergence === "unidentified" ? unidentifiedRows : unidentifiedRows.slice(0, 3)).map(({ item, index }) => <button key={item.id_transacao ?? index} type="button" onClick={() => onReviewBankStatement(view.bank_statement_id, index)}><span><strong>{item.description}</strong><small>Identificar fonte no extrato</small></span><b>{money(item.amount)}</b><span aria-hidden="true">↗</span></button>)}{unidentifiedRows.length > 3 && <button className="operation-divergence-expand" type="button" aria-expanded={expandedDivergence === "unidentified"} onClick={() => setExpandedDivergence(expandedDivergence === "unidentified" ? null : "unidentified")}>{expandedDivergence === "unidentified" ? "Mostrar menos" : `Ver todos os ${unidentifiedRows.length} recebimentos`}</button>}</div>}
      </div>}
    </section>
    <section className="operation-source-list" aria-label="Fontes da competência">
      <header className="operation-list-heading"><div><h2>{filter === "unidentified" ? "Recebimentos sem fonte" : "Fontes da competência"}</h2><p>{filter === "unidentified" ? "Selecione um recebimento para identificar a fonte no extrato." : "Ordenadas por prioridade e diferença. Selecione uma fonte para conferir os lançamentos."}</p></div><span className="operation-list-total">{filter === "unidentified" ? `${unidentifiedRows.length} ${unidentifiedRows.length === 1 ? "recebimento" : "recebimentos"}` : `${queue.length} ${queue.length === 1 ? "fonte" : "fontes"}`}</span></header>
      <div className="operation-list-tools"><div className="operation-list-filters" role="group" aria-label="Visões rápidas da fila" onKeyDown={onTabArrowKey}>{filters.map((item) => <button key={item.key} type="button" className={filter === item.key ? "is-active" : ""} aria-pressed={filter === item.key} onClick={() => onFilterChange(item.key)}>{item.label}<span>{item.count}</span></button>)}</div><label className="operation-list-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.1 4.1"/></svg><input value={queueQuery} onChange={(event) => onQueueQueryChange(event.target.value)} placeholder={filter === "unidentified" ? "Buscar recebimento" : "Buscar fonte"} aria-label={filter === "unidentified" ? "Buscar recebimento sem fonte" : "Buscar fonte na operação"} /></label></div>
      <div className="operation-saved-views"><label>Visões salvas<select aria-label="Aplicar visão salva" value={savedViews.find((item) => item.filter === filter && item.query === queueQuery.trim())?.id ?? ""} onChange={(event) => { const saved = savedViews.find((item) => item.id === event.target.value); if (saved) applySavedView(saved); }}><option value="">{savedViews.length ? "Selecionar visão" : "Nenhuma visão salva"}</option>{savedViews.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button ref={saveViewTrigger} type="button" onClick={() => { setSavingView((open) => !open); setViewFeedback(""); }}>{savingView ? "Cancelar" : "Salvar visão atual"}</button>{savedViews.find((item) => item.filter === filter && item.query === queueQuery.trim()) && <button type="button" className="operation-delete-view" onClick={() => { const selected = savedViews.find((item) => item.filter === filter && item.query === queueQuery.trim()); if (selected) { onDeleteView(selected.id); setViewFeedback(`Visão “${selected.name}” removida.`); } }}>Remover visão</button>}</div>
      {savingView && <form className="operation-save-view-form" onSubmit={saveCurrentView}><label>Nome da visão<input autoFocus maxLength={40} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Ex.: Fontes para revisar" /></label><button type="submit" disabled={!viewName.trim()}>Salvar nesta sessão</button></form>}
      {viewFeedback && <p className="operation-view-feedback" role="status">{viewFeedback}</p>}
      {filter === "mine" && <p className="operation-filter-hint">Atribuição demonstrativa a Guilherme Vital nesta competência.</p>}
      <div className="operation-source-rows" onKeyDown={moveRowFocus}>{filter === "unidentified" ? (visibleUnidentified.length ? visibleUnidentified.map(({ item, index }) => <button key={item.id_transacao ?? index} data-row-key={`receipt:${item.id_transacao ?? index}`} type="button" tabIndex={keyboardActiveRowKey === `receipt:${item.id_transacao ?? index}` ? 0 : -1} onFocus={() => setActiveRowKey(`receipt:${item.id_transacao ?? index}`)} className="operation-source-row operation-unidentified-row" onClick={() => view && onReviewBankStatement(view.bank_statement_id, index)}><span className="operation-row-identity"><strong>{item.description}</strong><small>{item.date.split("-").reverse().join("/")} · Extrato {bank ?? "bancário"}</small></span><span className="operation-row-values"><span>Recebido <b>{money(item.amount)}</b></span></span><span className="operation-row-next"><span className="operation-row-status is-review">Sem fonte</span><small>Analisar no extrato</small></span><span className="operation-row-arrow" aria-hidden="true">›</span></button>) : <div className="operation-list-empty">{unidentifiedRows.length ? "Nenhum recebimento corresponde à busca." : "Nenhum recebimento sem fonte nesta competência."}</div>) : visibleQueue.length ? visibleQueue.map((item) => {
        const status = queueStatus(item);
        return <button key={item.id_fonte} data-source-id={item.id_fonte} data-row-key={`source:${item.id_fonte}`} type="button" tabIndex={keyboardActiveRowKey === `source:${item.id_fonte}` ? 0 : -1} onFocus={() => setActiveRowKey(`source:${item.id_fonte}`)} className={`operation-source-row ${status === "balanced" ? "is-balanced" : ""} ${item.id_fonte === selectedSourceId ? "is-selected" : ""}`} onClick={(event) => { trigger.current = event.currentTarget; selectSource(item.id_fonte); }}>
          <span className="operation-row-identity"><strong>{item.nome_fonte}</strong><small>ID Fonte {sourceNumber(item.numero_fonte)}{item.assignee ? ` · ${item.assignee}` : ""}</small></span>
          <span className="operation-row-values"><span>Recebido <b>{money(item.recebido)}</b></span><span>Conciliado <b>{money(item.catalogo_bruto)}</b></span><span className="operation-row-difference">Diferença <b>{money(item.saldo_bruto)}</b></span></span>
          <span className="operation-row-next"><span className={`operation-row-status is-${status}`}>{statusLabel[status]}</span><small>{status === "pending" ? "Conferir lançamentos" : status === "review" ? "Revisar composição" : "Valores conferidos"}</small></span><span className="operation-row-arrow" aria-hidden="true">›</span>
        </button>;
      }) : <div className="operation-list-empty">{queue.length ? "Nenhuma fonte corresponde aos filtros." : "Nenhuma fonte com movimentação nesta competência."}</div>}</div>
    </section>

    {detailOpen && row && <div className="operation-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}><aside className="operation-drawer" ref={drawer} role="dialog" aria-modal="true" aria-label={`Operação de ${row.nome_fonte}`}>
      <div className="operation-drawer-top"><span>CONCILIAÇÃO · OPERAÇÃO</span><button type="button" ref={closeButton} className="operation-drawer-close" aria-label="Fechar detalhes da fonte" disabled={saving} onClick={closeDetail}>×</button></div>
      <header className="operation-heading"><div><h2>{row.nome_fonte}</h2><p>ID Fonte {sourceNumber(row.numero_fonte)} · {monthLabel(view.period)} · {view.entity}{bank ? ` · ${bank}` : ""}{statementVersion ? ` · Extrato v${statementVersion}` : ""}</p></div>{queueStatus(row) !== "balanced" && <span className={`operation-row-status is-${queueStatus(row)}`}>{statusLabel[queueStatus(row)]}</span>}</header>
      <label className="operation-source-switch">Trocar fonte<select aria-label="Fonte pagadora da operação" value={sourceId} disabled={manualOpen || saving} onChange={(event) => selectSource(event.target.value)}><option value="" disabled>Selecione uma fonte</option>{queue.map((item) => <option key={item.id_fonte} value={item.id_fonte}>{sourceNumber(item.numero_fonte)} · {item.nome_fonte}</option>)}</select></label>
      {nextSource && !manualOpen && <button type="button" className="operation-next-source" onClick={() => selectSource(nextSource.id_fonte)}>Próxima fonte <strong>{nextSource.nome_fonte}</strong><span aria-hidden="true">→</span></button>}
      {feedback && <StatusNotice tone="success">{feedback}</StatusNotice>}
      <section className="operation-totals" aria-label="Resumo da fonte"><div><span>Recebido</span><strong>{money(row.recebido)}</strong><small>{receivedCents === 0n ? "—" : "100,00%"}</small></div><div><span>Conciliado</span><strong>{money(row.catalogo_bruto)}</strong><small>{metricPercent(row.catalogo_bruto)}</small></div><div><span>A conciliar</span><strong>{money(row.saldo_bruto)}</strong><small>{metricPercent(row.saldo_bruto)}</small></div></section>
      {!manualOpen && <details className="operation-compare" open><summary>Conferir extrato e lançamentos lado a lado <span aria-hidden="true">⌄</span></summary><div className="operation-compare-columns"><div><h3>Recebimentos no extrato <small>{sourceReceipts.length}</small></h3>{sourceReceipts.length ? sourceReceipts.map((receipt) => <div className="operation-compare-line" key={receipt.key}><span><strong>{receipt.description}</strong><small>{receipt.date.split("-").reverse().join("/")}</small></span><b>{receipt.amount}</b></div>) : <p>Nenhum recebimento vinculado a esta fonte no extrato selecionado.</p>}</div><div><h3>Lançamentos do catálogo <small>{entries.length}</small></h3>{entries.length ? entries.map((entry) => <div className="operation-compare-line" key={entry.id}><span><strong>{entry.nome_artista || "Artista não identificado"}</strong><small>{entry.referencia || entry.origem}</small></span><b>{money(entry.valor)}</b></div>) : <p>Nenhum lançamento para esta fonte.</p>}</div></div></details>}
      {!manualOpen ? <><section className={`operation-next-step is-${queueStatus(row)}`} aria-label="Próximo passo"><div><span>PRÓXIMO PASSO</span><strong>{queueStatus(row) === "pending" ? `${money(row.saldo_bruto)} pendentes de conciliação` : queueStatus(row) === "review" ? `Lançamentos excedem o recebido em ${moneyFromCents(-cents(row.saldo_bruto))}` : "Valores desta fonte conciliados"}</strong><p>{queueStatus(row) === "pending" ? "Compare o recebido com os lançamentos. Adicione um valor somente após identificá-lo." : queueStatus(row) === "review" ? "Confira os lançamentos para localizar a diferença antes de adicionar novos valores." : "Confira a composição abaixo ou selecione outra fonte da fila."}</p></div>{queueStatus(row) === "pending" && <button ref={addButton} type="button" className="process" onClick={() => { setError(""); setArtistsError(""); setManualOpen(true); }}>Adicionar lançamento</button>}{queueStatus(row) === "review" && <button type="button" className="operation-step-secondary" onClick={() => setMode("entries")}>Ver lançamentos</button>}</section><section className="operation-composition" aria-label="Composição da fonte"><header className="operation-composition-heading"><div><h3>Composição da fonte</h3><p>{identifiedArtistCount} {identifiedArtistCount === 1 ? "artista" : "artistas"} · {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}</p></div>{queueStatus(row) !== "pending" && <button ref={addButton} type="button" className="operation-step-secondary" onClick={() => { setError(""); setArtistsError(""); setManualOpen(true); }}>Adicionar lançamento</button>}</header>
        <div className="operation-controls"><div className="operation-view-tabs" role="group" aria-label="Visualização da composição" onKeyDown={onTabArrowKey}><button type="button" className={mode === "artists" ? "is-active" : ""} aria-pressed={mode === "artists"} onClick={() => setMode("artists")}>Por artista</button><button type="button" className={mode === "entries" ? "is-active" : ""} aria-pressed={mode === "entries"} onClick={() => setMode("entries")}>Lançamentos</button></div><label className="search">Buscar<input aria-label="Buscar na operação" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Artista ou referência" /></label></div>
        {mode === "artists" ? <ul className="operation-composition-list">{filteredGroups.map((group) => <li key={group.key}><div><strong>{group.nome}</strong><small>{group.lancamentos} {group.lancamentos === 1 ? "lançamento" : "lançamentos"}{group.identificada ? "" : " · sem identificação"}</small></div><b>{moneyFromCents(group.valorCents)}</b></li>)}</ul>
          : <ul className="operation-composition-list">{filteredEntries.map((entry) => <li key={entry.id}><div><strong>{entry.nome_artista || "Artista não identificado"}</strong><small>{entry.data_referencia ?? entry.data.slice(0, 10)} · {entry.origem}{entry.referencia ? ` · ${entry.referencia}` : ""}</small></div><b>{money(entry.valor)}</b></li>)}</ul>}
        {(mode === "artists" ? filteredGroups.length : filteredEntries.length) === 0 && <div className="reconciliation-empty-state"><strong>{search ? "Nenhum resultado para a busca." : "Nenhum lançamento nesta fonte."}</strong><p>{search ? "Tente outra referência ou limpe a busca." : "Importe um arquivo ou adicione um lançamento manual para começar."}</p></div>}
      </section><details className="operation-activity"><summary><span>Trilha de auditoria</span><small>{sourceAudit.length} registros · prévia local</small></summary><div className="operation-activity-list">{sourceAudit.length ? sourceAudit.map((item) => <article className="operation-activity-row" key={item.id}><div><strong>{item.title}</strong><span>{item.actor}{item.demo ? " · demonstração" : ""}</span><p>{item.detail}</p>{item.changes.length > 0 && <dl>{item.changes.map((change) => <div key={change.field}><dt>{change.field}</dt><dd><span>{change.before}</span><span aria-hidden="true">→</span><strong>{change.after}</strong></dd></div>)}</dl>}</div><time dateTime={item.at}>{auditDate.format(new Date(item.at))}</time></article>) : <p>Nenhuma ação registrada nesta fonte durante a sessão.</p>}</div></details></> : <section className="operation-manual-panel" aria-label="Adicionar catálogo manualmente"><header className="operation-manual-header"><div><p className="eyebrow">NOVO LANÇAMENTO</p><h3>Adicionar manualmente</h3><p>Fonte: {row.nome_fonte}</p></div><button type="button" className="operation-drawer-close" aria-label="Fechar lançamento manual" disabled={saving} onClick={closeManual}>×</button></header>
        {pendingManualExit && <div className="operation-manual-warning" role="alert"><strong>Descartar lançamento não confirmado?</strong><p>Os campos preenchidos serão perdidos.</p><div><button ref={manualWarningContinue} type="button" onClick={() => { setPendingManualExit(null); requestAnimationFrame(() => dateInput.current?.focus()); }}>Continuar preenchendo</button><button type="button" onClick={discardManual}>Descartar rascunho</button></div></div>}
        <form onSubmit={saveManual}><div className="source-modal-body source-form-fields"><label>Data<input ref={dateInput} required type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label><label>Artista<select required value={artistId} onChange={(event) => setArtistId(event.target.value)}><option value="">Selecione um artista</option>{artists.map((artist) => <option key={artist.id_artista} value={artist.id_artista}>{artist.nome_artista}{artist.ativa ? "" : " (inativo)"}</option>)}</select></label><label>Valor (R$)<input required inputMode="decimal" value={amount} aria-invalid={Boolean(amount.trim()) && enteredCents === null} aria-describedby="manual-impact" onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label>
          <div id="manual-impact" className={`operation-entry-impact${projectedPending !== null && projectedPending < 0n ? " is-over" : ""}`} aria-live="polite" aria-atomic="true"><strong>Impacto deste lançamento</strong>{projectedPending === null ? <p>{amount.trim() ? "Informe um valor positivo com até duas casas decimais." : "Informe um valor para visualizar os novos saldos."}</p> : <><div><span>Conciliado <small>após salvar</small></span><b>{moneyFromCents(projectedConciliated!)}</b></div><div><span>A conciliar <small>após salvar</small></span><b>{moneyFromCents(projectedPending)}</b></div>{projectedPending < 0n && <p className="operation-entry-impact-warning">O lançamento ultrapassa o recebido em {moneyFromCents(-projectedPending)}. Confira o valor antes de confirmar.</p>}</>}</div>
          <label>Referência / observação<input required maxLength={500} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Identifique a origem deste valor" /></label>{artistsError && <StatusNotice tone="error">{artistsError}</StatusNotice>}{error && <StatusNotice tone="error">{error}</StatusNotice>}</div><footer className="source-modal-actions"><button type="button" className="cancel" disabled={saving} onClick={closeManual}>Cancelar</button><button type="submit" className="process" disabled={saving || !entryDate || !artistId || enteredCents === null || !reference.trim()}>{saving ? "Salvando…" : "Confirmar"}</button></footer></form>
      </section>}
    </aside></div>}
  </div>;
}
