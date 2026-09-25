import { useMemo, useState } from "react";
import type { ReconciliationRow, ReconciliationView } from "./types";
import { cents, money, moneyFromCents, percent, sourceNumber } from "./reconciliationFormat";

type Props = { view?: ReconciliationView; onOpenSource: (id: string) => void; onReviewBankStatement: (id: string) => void };
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

export default function ReconciliationOverviewPage({ view, onOpenSource, onReviewBankStatement }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>("first");
  const [detailTab, setDetailTab] = useState<"composition" | "entries" | "notes">("composition");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, ActivityEntry[]>>({});
  const activeRows = useMemo(() => view?.rows.filter(hasMovement) ?? [], [view]);
  const pendingRows = activeRows.filter((row) => cents(row.saldo_bruto) !== 0n);
  const completedRows = activeRows.length - pendingRows.length;
  const rows = activeRows.filter((row) =>
    (filter === "all" || cents(row.saldo_bruto) !== 0n) &&
    `${row.nome_fonte} ${sourceNumber(row.numero_fonte)}`.toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")));
  const selected = selectedId === "first" ? activeRows[0] : activeRows.find((row) => row.id_fonte === selectedId);
  const noteKey = selected ? `${view?.id_conciliacao}:${selected.id_fonte}` : "";
  const currentDraft = noteDrafts[noteKey] ?? "";
  const currentNotes = notes[noteKey] ?? [];
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
    const entry: ActivityEntry = {
      id: `${noteKey}-${Date.now()}`,
      text: content,
      author: "Guilherme Vital",
      role: "Estagiário de Backoffice",
      createdAt: new Date().toISOString(),
    };
    setNotes((current) => ({ ...current, [noteKey]: [entry, ...(current[noteKey] ?? [])] }));
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
          <td>{sourceNumber(row.numero_fonte)}</td><td><button type="button" className="overview-source-button" aria-label={`Ver detalhes de ${row.nome_fonte}`} onClick={() => { setSelectedId(row.id_fonte); setDetailTab("composition"); }}>{row.nome_fonte}</button></td>
          <td className="amount">{money(row.recebido)}</td><td className="amount">{money(row.catalogo_bruto)}</td><td className="amount">{money(row.saldo_bruto)}</td><td><span className={`overview-status overview-status--${status.tone}`}>{status.label}</span></td>
        </tr>;
      })}</tbody></table>{rows.length === 0 && <p className="overview-empty">Nenhuma fonte com movimento encontrada.</p>}</div>
      {view.pending_bank_count > 0 && <div className="overview-unidentified"><span className="overview-unidentified-dot" />{view.pending_bank_count} recebimento sem fonte identificada · {money(view.pending_bank_amount)}<button type="button" onClick={() => onReviewBankStatement(view.bank_statement_id)}>Analisar no extrato →</button></div>}
      {selected && <aside className="overview-detail" aria-label={`Detalhe de ${selected.nome_fonte}`}>
        <div className="overview-detail-head"><div><span className="overview-detail-kicker">FONTE PAGADORA · {sourceNumber(selected.numero_fonte)}</span><h2>{selected.nome_fonte}</h2><span className={`overview-status overview-status--${sourceStatus(selected).tone}`}>{sourceStatus(selected).label}</span></div><button type="button" className="overview-detail-close" aria-label="Fechar detalhe da fonte" onClick={() => setSelectedId(null)}>×</button></div>
        <div className="overview-detail-summary" aria-label="Valores da fonte"><div><span>Recebido</span><strong>{money(selected.recebido)}</strong></div><div><span>Conciliado</span><strong>{money(selected.catalogo_bruto)}</strong></div><div><span>A conciliar</span><strong>{money(selected.saldo_bruto)}</strong></div></div>
        <div className="overview-detail-section"><div className="overview-detail-tabs" role="group" aria-label="Dados da fonte"><button type="button" className={detailTab === "composition" ? "is-active" : ""} aria-pressed={detailTab === "composition"} onClick={() => setDetailTab("composition")}>Composição por artista</button><button type="button" className={detailTab === "entries" ? "is-active" : ""} aria-pressed={detailTab === "entries"} onClick={() => setDetailTab("entries")}>Lançamentos <span>{selected.entries.length}</span></button><button type="button" className={detailTab === "notes" ? "is-active" : ""} aria-pressed={detailTab === "notes"} onClick={() => setDetailTab("notes")}>Atividade <span>{activity.length}</span></button></div>
          {detailTab === "composition" ? <div className="overview-detail-list">{artistTotals.length ? artistTotals.map(([name, total]) => <div key={name}><span>{name}</span><strong>{moneyFromCents(total)}</strong></div>) : <p>Sem composição de artistas nesta fonte.</p>}</div>
            : detailTab === "entries" ? <div className="overview-detail-list">{selected.entries.length ? selected.entries.map((entry) => <div key={entry.id}><span><b>{entry.referencia}</b><small>{entry.nome_artista || "Artista não informado"}</small></span><strong>{money(entry.valor)}</strong></div>) : <p>Sem lançamentos nesta fonte.</p>}</div>
            : <div className="overview-notes"><label htmlFor="overview-note">Nova observação</label><textarea id="overview-note" value={currentDraft} onChange={(event) => setNoteDrafts((current) => ({ ...current, [noteKey]: event.target.value }))} placeholder="Registre um contexto sobre esta fonte…" rows={3} /><div className="overview-notes-actions"><small>Prévia local · disponível apenas nesta sessão</small><button type="button" disabled={!currentDraft.trim()} onClick={saveNote}>Salvar observação</button></div><div className="overview-activity-heading"><strong>Histórico da fonte</strong><small>Registros de demonstração e desta sessão</small></div><ol className="overview-activity-list">{activity.map((entry) => <li key={entry.id}><span className={`overview-activity-mark${entry.demo ? " is-demo" : ""}`} aria-hidden="true" /><div className="overview-activity-content"><div className="overview-activity-meta"><div><strong>{entry.author}</strong><span>{entry.role}</span></div><time dateTime={entry.createdAt}>{activityDate.format(new Date(entry.createdAt))}</time></div><p>{entry.text}</p></div></li>)}</ol></div>}
        </div>
        <button type="button" className="overview-open-operation" onClick={() => onOpenSource(selected.id_fonte)}>Abrir em Operação <span aria-hidden="true">↗</span></button>
      </aside>}
    </div>
    <section className="overview-closeout" aria-label="Conferência para fechamento"><header><div><h2>Conferência para fechamento</h2><p>Resumo do que já foi conferido e do que ainda pede ação nesta competência.</p></div><span className={pendingRows.length || view.pending_bank_count ? "is-pending" : "is-ready"}>{pendingRows.length || view.pending_bank_count ? "Em conferência" : "Pronta para revisão"}</span></header><div className="overview-closeout-row"><span>Fontes com movimento conciliadas</span><strong>{completedRows} de {activeRows.length}</strong>{pendingRows[0] && <button type="button" onClick={() => onOpenSource(pendingRows[0].id_fonte)}>Conferir fontes →</button>}</div><div className="overview-closeout-row"><span>Recebimentos sem fonte</span><strong>{view.pending_bank_count ? `${view.pending_bank_count} · ${money(view.pending_bank_amount)}` : "Nenhum"}</strong>{view.pending_bank_count > 0 && <button type="button" onClick={() => onReviewBankStatement(view.bank_statement_id)}>Analisar extrato →</button>}</div></section>
  </div>;
}
