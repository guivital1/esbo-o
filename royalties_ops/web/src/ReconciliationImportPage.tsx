import { useEffect, useMemo, useRef, useState } from "react";
import { getIngestionBatch, getIngestionBatches, getReconciliations } from "./api";
import CatalogImportWorkflow from "./CatalogImportModal";
import type { IngestionBatch, IngestionBatchDetails, ReconciliationView } from "./types";
import { cents, money, moneyFromCents, monthLabel } from "./reconciliationFormat";
import type { HistorySearchTarget } from "./Spotlight";
import StatusNotice from "./StatusNotice";

type HistoryBatch = IngestionBatch & { reconciliationId: string; period: string };
type SelectedBatch = { id: string; reconciliationId: string };
type ImportTab = "new" | "history";
type Props = { view?: ReconciliationView; entity: "HM" | "MDB"; tab: ImportTab; onTabChange: (tab: ImportTab) => void;
  openRequest?: HistorySearchTarget & { key: number };
  onConfirmed: (view: ReconciliationView) => void;
  onOpenSource: (id: string) => void; onPreviewOpenChange: (open: boolean) => void };

export default function ReconciliationImportPage({ view, entity, tab, onTabChange, onConfirmed, onOpenSource, onPreviewOpenChange, openRequest }: Props) {
  const [batches, setBatches] = useState<HistoryBatch[]>([]);
  const [sourceCountsByPeriod, setSourceCountsByPeriod] = useState<Record<string, number>>({});
  const [selectedBatch, setSelectedBatch] = useState<SelectedBatch>();
  const [details, setDetails] = useState<IngestionBatchDetails>();
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const closeDetails = () => {
    const fileKey = selectedBatch && `${selectedBatch.reconciliationId}:${selectedBatch.id}`;
    const fileButton = fileKey ? fileButtonsRef.current.get(fileKey) : undefined;
    setSelectedBatch(undefined);
    setDetails(undefined);
    fileButton?.focus({ preventScroll: true });
    fileButton?.scrollIntoView({ block: "nearest" });
  };
  useEffect(() => {
    if (!selectedBatch || tab !== "history") return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDetails(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedBatch, tab]);
  useEffect(() => { setSelectedBatch(undefined); setDetails(undefined); setBatches([]); setSourceCountsByPeriod({}); setExpandedPeriod(null); setPeriodFilter(""); setFileQuery(""); setError(""); setHistoryLoading(true); }, [entity]);

  useEffect(() => {
    if (!openRequest || openRequest.entity !== entity || tab !== "history") return;
    setPeriodFilter("");
    setFileQuery("");
    setExpandedPeriod(openRequest.period);
    setSelectedBatch(openRequest.batchId && openRequest.reconciliationId
      ? { id: openRequest.batchId, reconciliationId: openRequest.reconciliationId } : undefined);
  }, [openRequest, entity, tab]);

  useEffect(() => {
    if (tab !== "history") return;
    const controller = new AbortController();
    setHistoryLoading(true);
    getReconciliations(entity, undefined, controller.signal).then(async (reconciliations) => {
      const groups = await Promise.all(reconciliations.map(async (reconciliation) => {
        const rows = await getIngestionBatches(reconciliation.id_conciliacao, controller.signal);
        const sourceIds = await Promise.all(rows.map(async (row) => {
          const detail = await getIngestionBatch(reconciliation.id_conciliacao, row.id, controller.signal);
          return detail.entries.map((entry) => entry.id_fonte).filter(Boolean);
        }));
        return { rows: rows.map((row) => ({ ...row, reconciliationId: reconciliation.id_conciliacao, period: reconciliation.period })), period: reconciliation.period, sourceIds: sourceIds.flat() };
      }));
      if (!controller.signal.aborted) {
        const byPeriod = new Map<string, Set<string>>();
        for (const group of groups) {
          const ids = byPeriod.get(group.period) ?? new Set<string>();
          group.sourceIds.forEach((id) => ids.add(id));
          byPeriod.set(group.period, ids);
        }
        setSourceCountsByPeriod(Object.fromEntries([...byPeriod].map(([period, ids]) => [period, ids.size])));
        setBatches(groups.flatMap((group) => group.rows).sort((a, b) => b.importado_em.localeCompare(a.importado_em)));
      }
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico.");
    }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [entity, revision, tab]);

  useEffect(() => {
    if (!selectedBatch) { setDetails(undefined); return; }
    const controller = new AbortController();
    setDetails(undefined); setExpandedSourceId(null);
    getIngestionBatch(selectedBatch.reconciliationId, selectedBatch.id, controller.signal).then((batch) => { if (!controller.signal.aborted) setDetails(batch); }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível abrir a importação.");
    });
    return () => controller.abort();
  }, [selectedBatch]);

  const months = useMemo(() => {
    const grouped = new Map<string, HistoryBatch[]>();
    for (const batch of batches) grouped.set(batch.period, [...(grouped.get(batch.period) ?? []), batch]);
    return [...grouped].sort(([a], [b]) => b.localeCompare(a));
  }, [batches]);

  const visibleMonths = useMemo(() => {
    const term = fileQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return months.filter(([period]) => !periodFilter || period === periodFilter).map(([period, items]) => [
      period,
      term ? items.filter((batch) => (batch.arquivo || "Lançamento manual").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(term)) : items,
    ] as [string, HistoryBatch[]]).filter(([, items]) => items.length);
  }, [months, periodFilter, fileQuery]);

  const fileSequence = useMemo(() => {
    const sequence = new Map<string, number>();
    const versions = new Map<string, number>();
    for (const batch of [...batches].sort((a, b) => a.importado_em.localeCompare(b.importado_em) || a.id.localeCompare(b.id))) {
      const fileKey = `${batch.period}:${batch.arquivo ?? "manual"}`;
      const position = (sequence.get(fileKey) ?? 0) + 1;
      sequence.set(fileKey, position);
      versions.set(`${batch.reconciliationId}:${batch.id}`, position);
    }
    return versions;
  }, [batches]);

  useEffect(() => {
    if (!visibleMonths.length || expandedPeriod !== null) return;
    setExpandedPeriod(visibleMonths.find(([period]) => period === view?.period)?.[0] ?? visibleMonths[0][0]);
  }, [expandedPeriod, visibleMonths, view?.period]);

  const sourceGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; total: bigint; entries: IngestionBatchDetails["entries"] }>();
    for (const entry of details?.entries ?? []) {
      const group = groups.get(entry.id_fonte) ?? { id: entry.id_fonte, name: entry.nome_fonte, total: 0n, entries: [] };
      group.total += cents(entry.valor); group.entries.push(entry); groups.set(entry.id_fonte, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [details]);
  const selectedHistoryBatch = batches.find((batch) => batch.id === selectedBatch?.id && batch.reconciliationId === selectedBatch.reconciliationId);

  return <div className="reconciliation-import-page" aria-label="Importar dados da conciliação">
    <div className="import-page-tabs" role="group" aria-label="Áreas de importação"><button type="button" className={tab === "new" ? "is-active" : ""} onClick={() => onTabChange("new")}>Nova importação</button><button type="button" className={tab === "history" ? "is-active" : ""} onClick={() => onTabChange("history")}>Histórico</button></div>
    {tab === "new" && (view ? <CatalogImportWorkflow key={view.id_conciliacao} reconciliationId={view.id_conciliacao} onOpenSource={onOpenSource} onPreviewOpenChange={onPreviewOpenChange} onConfirmed={(batchId, saved) => {
      onConfirmed(saved); setSelectedBatch({ id: batchId, reconciliationId: saved.id_conciliacao });
      setExpandedPeriod(saved.period); setRevision((current) => current + 1); setError("");
    }} /> : <p className="reconciliation-empty">Selecione ou inicie uma conciliação para importar um CSV nesta competência.</p>)}
    {error && <StatusNotice tone="error">{error}</StatusNotice>}
    {tab === "history" && <div className="import-history-area"><section className="table-section import-history"><div className="table-toolbar"><p>{historyLoading ? "Carregando histórico…" : periodFilter || fileQuery ? `${visibleMonths.length} ${visibleMonths.length === 1 ? "competência encontrada" : "competências encontradas"}` : `${months.length} ${months.length === 1 ? "competência" : "competências"} com importações`}</p>
      {!historyLoading && months.length > 0 && <div className="import-history-filters"><select aria-label="Filtrar competência do histórico" value={periodFilter} onChange={(event) => { setPeriodFilter(event.target.value); setExpandedPeriod(null); setSelectedBatch(undefined); }}><option value="">Todas as competências</option>{months.map(([period]) => <option key={period} value={period}>{monthLabel(period)}</option>)}</select><input type="search" aria-label="Buscar arquivo no histórico" placeholder="Buscar arquivo" value={fileQuery} onChange={(event) => { setFileQuery(event.target.value); setExpandedPeriod(null); setSelectedBatch(undefined); }} /></div>}</div>
      {historyLoading ? <StatusNotice tone="loading" className="import-history-status">Carregando importações…</StatusNotice> : visibleMonths.length ? <div className="import-month-list">{visibleMonths.map(([period, items]) => {
        const isOpen = expandedPeriod === period;
        const monthItems = months.find(([month]) => month === period)?.[1] ?? items;
        const total = monthItems.reduce((sum, batch) => sum + cents(batch.valor_total), 0n);
        const label = monthLabel(period);
        return <section className={`import-month${isOpen ? " is-open" : ""}`} key={period}>
          <button type="button" className="import-month-toggle" aria-expanded={isOpen} aria-controls={`import-month-${period}`} onClick={() => { setExpandedPeriod(isOpen ? "" : period); setSelectedBatch(undefined); }}>
            <span className="import-month-title"><span className="import-month-chevron" aria-hidden="true">⌄</span><strong>{label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1)}</strong><small>{items.length}{items.length < monthItems.length ? ` de ${monthItems.length}` : ""} {monthItems.length === 1 ? "importação" : "importações"}{isOpen && sourceCountsByPeriod[period] !== undefined ? ` · ${sourceCountsByPeriod[period]} ${sourceCountsByPeriod[period] === 1 ? "fonte pagadora" : "fontes pagadoras"}` : ""}</small></span>
            <span className="import-month-total">{moneyFromCents(total)}</span>
          </button>
          {isOpen && <div id={`import-month-${period}`} className="table-wrap"><table className="batch-table"><thead><tr><th>Data</th><th>Arquivo</th><th className="amount">Valor</th></tr></thead><tbody>{items.map((batch) => <tr key={`${batch.reconciliationId}-${batch.id}`} className={selectedBatch?.id === batch.id && selectedBatch.reconciliationId === batch.reconciliationId ? "is-selected" : ""}><td>{new Date(batch.importado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td><div className="import-file-cell"><button type="button" className="batch-open" ref={(node) => { const key = `${batch.reconciliationId}:${batch.id}`; if (node) fileButtonsRef.current.set(key, node); else fileButtonsRef.current.delete(key); }} onClick={() => setSelectedBatch({ id: batch.id, reconciliationId: batch.reconciliationId })}>{batch.arquivo || "Lançamento manual"}</button><small>Envio {fileSequence.get(`${batch.reconciliationId}:${batch.id}`)} · {new Date(batch.importado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</small></div></td><td className="amount">{money(batch.valor_total)}</td></tr>)}</tbody></table></div>}
        </section>;
      })}</div> : !error && <div className="reconciliation-empty-state"><strong>{months.length ? "Nenhum arquivo corresponde aos filtros." : `Nenhuma importação para ${entity}.`}</strong><p>{months.length ? "Ajuste a competência ou a busca pelo nome do arquivo." : "Os meses aparecem aqui após a primeira importação em cada competência."}</p><button type="button" className={`import-empty-action${months.length ? "" : " is-primary"}`} onClick={() => { if (months.length) { setPeriodFilter(""); setFileQuery(""); setExpandedPeriod(null); } else onTabChange("new"); }}>{months.length ? "Limpar filtros" : "Nova importação"}</button></div>}
    </section>
    {selectedBatch && <aside className="batch-details import-detail-panel" aria-label="Detalhes da importação"><div className="batch-details-heading"><div><p className="eyebrow">{selectedHistoryBatch ? monthLabel(selectedHistoryBatch.period) : "Importação"}</p><h2>{details?.arquivo || selectedHistoryBatch?.arquivo || "Importação"}</h2>{selectedHistoryBatch && <small>{new Date(selectedHistoryBatch.importado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</small>}</div><button ref={closeButtonRef} type="button" className="import-detail-close" aria-label="Fechar detalhes da importação" onClick={closeDetails}>×</button></div>
      {details ? <><div className="import-detail-total"><span>Valor importado</span><strong>{money(details.valor_total)}</strong></div>
        <div className="import-detail-entries"><h3>Lançamentos por fonte pagadora</h3>{sourceGroups.length ? sourceGroups.map((group) => {
          const isOpen = expandedSourceId === group.id;
          return <section className="import-source-group" key={group.id}><button type="button" className="import-source-toggle" aria-expanded={isOpen} onClick={() => setExpandedSourceId(isOpen ? null : group.id)}><span><i aria-hidden="true">⌄</i><strong>{group.name}</strong></span><b>{moneyFromCents(group.total)}</b></button>
            {isOpen && <div className="import-source-entries">{group.entries.slice(0, 100).map((entry, index) => <article key={`${entry.id_artista}-${entry.referencia}-${index}`}><div><strong>{entry.nome_artista}</strong><span>{entry.data}</span><small>{entry.referencia}</small></div><b>{money(entry.valor)}</b></article>)}{group.entries.length > 100 && <p className="source-help">Exibindo parte dos lançamentos desta fonte.</p>}{selectedBatch.reconciliationId === view?.id_conciliacao && <button type="button" className="import-source-operation" onClick={() => onOpenSource(group.id)}>Abrir fonte em Operação ↗</button>}</div>}
          </section>;
        }) : <p className="source-help">Nenhum lançamento neste lote.</p>}</div></>
        : <StatusNotice tone="loading">Carregando detalhes da importação…</StatusNotice>}
    </aside>}</div>}
  </div>;
}
