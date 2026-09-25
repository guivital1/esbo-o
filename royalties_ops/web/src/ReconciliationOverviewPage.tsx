import { useEffect, useMemo, useRef, useState } from "react";
import type { BankStatementView, IngestionBatch, ReconciliationRow, ReconciliationView } from "./types";
import type { SessionAction, SessionNote } from "./sessionNotes";
import { cents, money, moneyFromCents, percent, sourceNumber } from "./reconciliationFormat";

type Props = { view?: ReconciliationView; statement?: BankStatementView; batches: IngestionBatch[];
  sessionNotes: SessionNote[]; sessionActions: SessionAction[]; onAddSessionNote: (note: SessionNote) => void;
  onOpenSource: (id: string) => void; onReviewBankStatement: (id: string, transactionIndex?: number) => void };
type ListFilter = "all" | "pending";
type ActivityEntry = { id: string; text: string; author: string; role: string; createdAt: string; demo?: boolean };
const activityDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const hasMovement = (row: ReconciliationRow) =>
  cents(row.recebido) !== 0n || cents(row.catalogo_bruto) !== 0n || cents(row.saldo_bruto) !== 0n;
function sourceStatus(row: ReconciliationRow) {
  if (cents(row.saldo_bruto) < 0n) return { label: "Revisar", tone: "review" };
  if (cents(row.saldo_bruto) > 0n) return { label: "A conciliar", tone: "pending" };
  return { label: "Conciliada", tone: "done" };
}

export default function ReconciliationOverviewPage({ view, statement, batches, sessionNotes, sessionActions, onAddSessionNote, onOpenSource, onReviewBankStatement }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>("first");
  const [detailTab, setDetailTab] = useState<"composition" | "entries" | "notes">("composition");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [closeoutOpen, setCloseoutOpen] = useState(false);
  const closeoutDismiss = useRef<HTMLButtonElement>(null);
  const closeoutDialog = useRef<HTMLElement>(null);
  const closeoutTrigger = useRef<HTMLButtonElement>(null);
  const detailAside = useRef<HTMLElement>(null);
  const detailDismiss = useRef<HTMLButtonElement>(null);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const closeDetail = () => { setSelectedId(null); requestAnimationFrame(() => detailTrigger.current?.focus()); };
  useEffect(() => {
    if (!closeoutOpen) return;
    closeoutDismiss.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setCloseoutOpen(false); return; }
      if (event.key !== "Tab" || !closeoutDialog.current) return;
      const buttons = [...closeoutDialog.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); requestAnimationFrame(() => closeoutTrigger.current?.focus()); };
  }, [closeoutOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailAside.current?.contains(document.activeElement)) { event.preventDefault(); closeDetail(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const activeRows = useMemo(() => view?.rows.filter(hasMovement) ?? [], [view]);
  const pendingRows = activeRows.filter((row) => cents(row.saldo_bruto) !== 0n);
  const completedRows = activeRows.length - pendingRows.length;
  const positiveRows = activeRows.filter((row) => cents(row.saldo_bruto) > 0n);
  const excessRows = activeRows.filter((row) => cents(row.saldo_bruto) < 0n);
  const unidentifiedRows = statement?.rows.map((row, index) => ({ row, index }))
    .filter(({ row, index }) => row.review_required && !statement.allocations?.[index]) ?? [];
  const unidentifiedCount = statement ? unidentifiedRows.length : view?.pending_bank_count ?? 0;
  const unidentifiedAmount = statement ? moneyFromCents(unidentifiedRows.reduce((total, { row }) => total + cents(row.amount), 0n)) : money(view?.pending_bank_amount ?? "0");
  const blockingCount = positiveRows.length + excessRows.length + unidentifiedCount;
  const rows = activeRows.filter((row) =>
    (filter === "all" || cents(row.saldo_bruto) !== 0n) &&
    `${row.nome_fonte} ${sourceNumber(row.numero_fonte)}`.toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")));
  const selected = selectedId === "first" ? activeRows[0] : activeRows.find((row) => row.id_fonte === selectedId);
  const noteKey = selected ? `${view?.id_conciliacao}:${selected.id_fonte}` : "";
  const currentDraft = noteDrafts[noteKey] ?? "";
  const currentNotes: ActivityEntry[] = sessionNotes.filter((note) => note.reconciliationId === view?.id_conciliacao && note.sourceId === selected?.id_fonte);
  const demoActivity: ActivityEntry | null = selected ? {
    id: `demo-${noteKey}`,
    text: "Fonte incluída na conferência desta competência.",
    author: "Equipe Backoffice",
    role: "Registro demonstrativo",
    createdAt: "2026-08-20T10:15:00",
    demo: true,
  } : null;
  const activity = demoActivity ? [...currentNotes, demoActivity] : currentNotes;
  const saveNote = () => {
    const content = currentDraft.trim();
    if (!content) return;
    if (!view || !selected) return;
    const entry: SessionNote = {
      id: crypto.randomUUID(), reconciliationId: view.id_conciliacao, sourceId: selected.id_fonte,
      text: content,
      author: "Guilherme Vital",
      role: "Estagiário de Backoffice",
      createdAt: new Date().toISOString(),
    };
    onAddSessionNote(entry);
    setNoteDrafts((current) => ({ ...current, [noteKey]: "" }));
  };
  const artistTotals = useMemo(() => {
    if (!selected) return [];
    const totals = new Map<string, bigint>();
    for (const entry of selected.entries) {
      const name = entry.nome_artista || "Artista não informado";
      totals.set(name, (totals.get(name) ?? 0n) + cents(entry.valor));
    }
    return [...totals].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [selected]);
  const timeline = view ? [
    ...(statement?.imported_at ? [{ id: `statement-${statement.id_extrato}`, at: statement.imported_at, title: "Extrato registrado", detail: `${statement.bank} · v${statement.version} · ${statement.file_name}`, actor: "Equipe Backoffice · demonstração" }] : []),
    { id: `reconciliation-${view.id_conciliacao}`, at: view.created_at, title: "Conciliação iniciada", detail: `${view.entity} · ${view.period}`, actor: "Equipe Backoffice · demonstração" },
    ...batches.map((batch) => ({ id: `batch-${batch.id}`, at: batch.importado_em, title: "Lote de lançamentos importado", detail: `${batch.arquivo ?? "Lote manual"} · ${money(batch.valor_total)}`, actor: "Operador Demo A" })),
    ...sessionNotes.filter((note) => note.reconciliationId === view.id_conciliacao).map((note) => ({ id: note.id, at: note.createdAt, title: `Observação · ${view.rows.find((row) => row.id_fonte === note.sourceId)?.nome_fonte ?? "Fonte"}`, detail: note.text, actor: `${note.author} · ${note.role}` })),
    ...sessionActions.filter((action) => action.reconciliationId === view.id_conciliacao).map((action) => ({ id: action.id, at: action.createdAt, title: action.title, detail: action.detail, actor: action.actor })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];

  if (!view) return <p className="reconciliation-empty">Selecione uma conciliação existente para acompanhar os valores. Uma conciliação nova pode ser iniciada em Operação ou Importar dados.</p>;

  return <div className="reconciliation-overview overview-workspace" aria-label="Visão geral da conciliação">
    <section className="overview-summary" aria-label="Resumo financeiro">
      <article><div className="overview-summary-label"><span>Recebido</span><b>{percent(view.totals.received_percent)}</b></div><strong>{money(view.totals.received)}</strong><small>Na competência selecionada</small></article>
      <article><div className="overview-summary-label"><span>Conciliado</span><b>{percent(view.totals.catalog_gross_percent)}</b></div><strong>{money(view.totals.catalog_gross)}</strong><small>Do total recebido</small></article>
      <article><div className="overview-summary-label"><span>A conciliar</span><b>{percent(view.totals.gross_balance_percent)}</b></div><strong>{money(view.totals.gross_balance)}</strong><small>Do total recebido</small></article>
    </section>
    <div className="overview-list-area">
      <div className="overview-tabs" role="group" aria-label="Filtrar fontes pagadoras">
        <button type="button" className={filter === "all" ? "is-active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Todas <span>{activeRows.length}</span></button>
        <button type="button" className={filter === "pending" ? "is-active" : ""} aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>A conciliar <span>{pendingRows.length}</span></button>
        <label className="overview-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.1 4.1"/></svg><input aria-label="Buscar fonte na visão geral" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar fonte" /></label>
      </div>
      <div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>ID Fonte</th><th>Fonte pagadora</th><th>Recebido</th><th>Conciliado</th><th>A conciliar</th><th>Status</th></tr></thead><tbody>{rows.map((row) => {
        const status = sourceStatus(row);
        return <tr key={row.id_fonte} className={selected?.id_fonte === row.id_fonte ? "is-selected" : ""}>
          <td>{sourceNumber(row.numero_fonte)}</td><td><button type="button" className="overview-source-button" aria-label={`Ver detalhes de ${row.nome_fonte}`} onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedId(row.id_fonte); setDetailTab("composition"); requestAnimationFrame(() => detailDismiss.current?.focus()); }}>{row.nome_fonte}</button></td>
          <td className="amount">{money(row.recebido)}</td><td className="amount">{money(row.catalogo_bruto)}</td><td className="amount">{money(row.saldo_bruto)}</td><td><span className={`overview-status overview-status--${status.tone}`}>{status.label}</span></td>
        </tr>;
      })}</tbody></table>{rows.length === 0 && <p className="overview-empty">Nenhuma fonte com movimento encontrada.</p>}</div>
      {unidentifiedCount > 0 && <div className="overview-unidentified"><span className="overview-unidentified-dot" />{unidentifiedCount} recebimento sem fonte identificada · {unidentifiedAmount}<button type="button" onClick={() => onReviewBankStatement(view.bank_statement_id, unidentifiedRows[0]?.index)}>Analisar no extrato →</button></div>}
      {selected && <aside ref={detailAside} className="overview-detail" aria-label={`Detalhe de ${selected.nome_fonte}`}>
        <div className="overview-detail-head"><div><span className="overview-detail-kicker">FONTE PAGADORA · {sourceNumber(selected.numero_fonte)}</span><h2>{selected.nome_fonte}</h2><span className={`overview-status overview-status--${sourceStatus(selected).tone}`}>{sourceStatus(selected).label}</span></div><button ref={detailDismiss} type="button" className="overview-detail-close" aria-label="Fechar detalhe da fonte" onClick={closeDetail}>×</button></div>
        <div className="overview-detail-summary" aria-label="Valores da fonte"><div><span>Recebido</span><strong>{money(selected.recebido)}</strong></div><div><span>Conciliado</span><strong>{money(selected.catalogo_bruto)}</strong></div><div><span>A conciliar</span><strong>{money(selected.saldo_bruto)}</strong></div></div>
        <div className="overview-detail-section"><div className="overview-detail-tabs" role="group" aria-label="Dados da fonte"><button type="button" className={detailTab === "composition" ? "is-active" : ""} aria-pressed={detailTab === "composition"} onClick={() => setDetailTab("composition")}>Composição por artista</button><button type="button" className={detailTab === "entries" ? "is-active" : ""} aria-pressed={detailTab === "entries"} onClick={() => setDetailTab("entries")}>Lançamentos <span>{selected.entries.length}</span></button><button type="button" className={detailTab === "notes" ? "is-active" : ""} aria-pressed={detailTab === "notes"} onClick={() => setDetailTab("notes")}>Atividade <span>{activity.length}</span></button></div>
          {detailTab === "composition" ? <div className="overview-detail-list">{artistTotals.length ? artistTotals.map(([name, total]) => <div key={name}><span>{name}</span><strong>{moneyFromCents(total)}</strong></div>) : <p>Sem composição de artistas nesta fonte.</p>}</div>
            : detailTab === "entries" ? <div className="overview-detail-list">{selected.entries.length ? selected.entries.map((entry) => <div key={entry.id}><span><b>{entry.referencia}</b><small>{entry.nome_artista || "Artista não informado"}</small></span><strong>{money(entry.valor)}</strong></div>) : <p>Sem lançamentos nesta fonte.</p>}</div>
            : <div className="overview-notes"><label htmlFor="overview-note">Nova observação</label><textarea id="overview-note" value={currentDraft} onChange={(event) => setNoteDrafts((current) => ({ ...current, [noteKey]: event.target.value }))} placeholder="Registre um contexto sobre esta fonte…" rows={3} /><div className="overview-notes-actions"><small>Prévia local · disponível apenas nesta sessão</small><button type="button" disabled={!currentDraft.trim()} onClick={saveNote}>Salvar observação</button></div><div className="overview-activity-heading"><strong>Histórico da fonte</strong><small>Registros de demonstração e desta sessão</small></div><ol className="overview-activity-list">{activity.map((entry) => <li key={entry.id}><span className={`overview-activity-mark${entry.demo ? " is-demo" : ""}`} aria-hidden="true" /><div className="overview-activity-content"><div className="overview-activity-meta"><div><strong>{entry.author}</strong><span>{entry.role}</span></div><time dateTime={entry.createdAt}>{activityDate.format(new Date(entry.createdAt))}</time></div><p>{entry.text}</p></div></li>)}</ol></div>}
        </div>
        <button type="button" className="overview-open-operation" onClick={() => onOpenSource(selected.id_fonte)}>Abrir em Operação <span aria-hidden="true">↗</span></button>
      </aside>}
    </div>
    <section className="overview-closeout" aria-label="Pendências por motivo e fechamento"><header><div><h2>Conferência para fechamento</h2><p>Pendências organizadas pelo próximo passo.</p></div><span className={blockingCount ? "is-pending" : "is-ready"}>{blockingCount ? `${blockingCount} ${blockingCount === 1 ? "pendência" : "pendências"}` : "Pronta para revisão"}</span></header>
      <div className="overview-closeout-row"><span>Fontes conciliadas</span><strong>{completedRows} de {activeRows.length}</strong><span /></div>
      <div className="overview-closeout-row"><span>Diferença a conciliar</span><strong>{positiveRows.length} {positiveRows.length === 1 ? "fonte" : "fontes"}</strong>{positiveRows[0] ? <button type="button" onClick={() => onOpenSource(positiveRows[0].id_fonte)}>Conferir fonte →</button> : <span />}</div>
      <div className="overview-closeout-row"><span>Catálogo acima do recebido</span><strong>{excessRows.length} {excessRows.length === 1 ? "fonte" : "fontes"}</strong>{excessRows[0] ? <button type="button" onClick={() => onOpenSource(excessRows[0].id_fonte)}>Revisar saldo →</button> : <span />}</div>
      <div className="overview-closeout-row"><span>Recebimentos sem fonte</span><strong>{unidentifiedCount ? `${unidentifiedCount} · ${unidentifiedAmount}` : "Nenhum"}</strong>{unidentifiedCount ? <button type="button" onClick={() => onReviewBankStatement(view.bank_statement_id, unidentifiedRows[0]?.index)}>Analisar extrato →</button> : <span />}</div>
      <footer><button ref={closeoutTrigger} type="button" className="overview-closeout-preview" onClick={() => setCloseoutOpen(true)}>Prévia de fechamento <span aria-hidden="true">→</span></button></footer>
    </section>
    <section className="overview-timeline" aria-label="Linha do tempo da competência"><header><div><h2>Linha do tempo</h2><p>Importações, observações e ações desta competência.</p></div><span>{timeline.length} {timeline.length === 1 ? "registro" : "registros"}</span></header><ol>{timeline.map((event) => <li key={event.id}><span className="overview-timeline-mark" aria-hidden="true" /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.actor}</small></div><time dateTime={event.at}>{activityDate.format(new Date(event.at))}</time></li>)}</ol></section>
    {closeoutOpen && <div className="overview-closeout-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCloseoutOpen(false); }}><section ref={closeoutDialog} className="overview-closeout-dialog" role="dialog" aria-modal="true" aria-labelledby="closeout-title" aria-describedby="closeout-description"><header><div><span>REVISÃO DA COMPETÊNCIA</span><h2 id="closeout-title">Prévia de fechamento</h2><p id="closeout-description">Confira os totais e resolva as pendências antes de concluir a competência.</p></div><button ref={closeoutDismiss} type="button" aria-label="Fechar prévia de fechamento" onClick={() => setCloseoutOpen(false)}>×</button></header><div className="overview-closeout-totals"><div><span>Recebido</span><strong>{money(view.totals.received)}</strong></div><div><span>Conciliado</span><strong>{money(view.totals.catalog_gross)}</strong></div><div><span>A conciliar</span><strong>{money(view.totals.gross_balance)}</strong></div></div><div className="overview-closeout-blockers"><h3>{blockingCount ? "Antes de concluir" : "Valores prontos para revisão"}</h3>{blockingCount ? <ul>{positiveRows.length > 0 && <li>{positiveRows.length} {positiveRows.length === 1 ? "fonte com diferença" : "fontes com diferença"} a conciliar</li>}{excessRows.length > 0 && <li>{excessRows.length} {excessRows.length === 1 ? "fonte com catálogo" : "fontes com catálogo"} acima do recebido</li>}{unidentifiedCount > 0 && <li>{unidentifiedCount} {unidentifiedCount === 1 ? "recebimento sem fonte" : "recebimentos sem fonte"}</li>}</ul> : <p>Esta é somente uma revisão visual. Nenhum status financeiro será alterado.</p>}</div><footer><span>{blockingCount ? "Conclusão indisponível enquanto houver pendências." : "Conclusão real indisponível neste protótipo."}</span><button type="button" onClick={() => setCloseoutOpen(false)}>Voltar à conferência</button></footer></section></div>}
  </div>;
}
