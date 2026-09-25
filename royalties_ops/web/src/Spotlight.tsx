import { useEffect, useMemo, useRef, useState } from "react";
import { getIngestionBatches, getReconciliations } from "./api";
import { money, monthLabel } from "./reconciliationFormat";
import type { Source } from "./types";

export type SearchArea = "bank" | "sources" | "overview" | "operation" | "import";
export type HistorySearchTarget = { entity: "HM" | "MDB"; period: string; batchId?: string; reconciliationId?: string };
type Result = { key: string; group: "Páginas" | "Fontes pagadoras" | "Competências" | "Arquivos importados"; title: string; detail: string; terms: string; area: SearchArea; sourceId?: string; history?: HistorySearchTarget };
type Props = { sources: Source[]; onClose: () => void; onNavigate: (area: SearchArea, sourceId?: string, history?: HistorySearchTarget) => void };

const pages: Result[] = [
  { key: "bank", group: "Páginas", title: "Histórico de extratos", detail: "Importações", terms: "extrato banco histórico", area: "bank" },
  { key: "sources", group: "Páginas", title: "Fontes pagadoras", detail: "Importações", terms: "cadastro identificação", area: "sources" },
  { key: "overview", group: "Páginas", title: "Visão geral", detail: "Conciliação", terms: "resumo financeiro", area: "overview" },
  { key: "operation", group: "Páginas", title: "Operação", detail: "Conciliação", terms: "lançamentos associar", area: "operation" },
  { key: "import", group: "Páginas", title: "Importar dados", detail: "Conciliação", terms: "csv histórico importações", area: "import" },
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function Spotlight({ sources, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [historyResults, setHistoryResults] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all((["MDB", "HM"] as const).map(async (entity) => {
      const reconciliations = await getReconciliations(entity, undefined, controller.signal);
      const groups = await Promise.all(reconciliations.map(async (reconciliation) => {
        const batches = await getIngestionBatches(reconciliation.id_conciliacao, controller.signal);
        return batches.map((batch) => ({ reconciliation, batch }));
      }));
      return groups.flat();
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const results: Result[] = [];
      const months = new Set<string>();
      for (const { reconciliation, batch } of groups.flat()) {
        const { entity, period, id_conciliacao } = reconciliation;
        const label = monthLabel(period);
        const numericMonth = `${period.slice(5, 7)}/${period.slice(0, 4)}`;
        const monthKey = `${entity}:${period}`;
        if (!months.has(monthKey)) {
          months.add(monthKey);
          results.push({ key: `month-${monthKey}`, group: "Competências", title: label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1), detail: `${entity} · Histórico de importações`, terms: `${period} ${numericMonth} ${entity} mês competencia importacoes`, area: "import", history: { entity, period } });
        }
        results.push({ key: `batch-${id_conciliacao}-${batch.id}`, group: "Arquivos importados", title: batch.arquivo || "Lançamento manual", detail: `${entity} · ${label} · ${money(batch.valor_total)}`, terms: `${period} ${numericMonth} ${entity} ${batch.arquivo || "manual"} ${new Date(batch.importado_em).toLocaleDateString("pt-BR")}`, area: "import", history: { entity, period, batchId: batch.id, reconciliationId: id_conciliacao } });
      }
      setHistoryResults(results);
    }).catch(() => { /* Busca local permanece disponível se o histórico falhar. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); } };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [onClose]);
  const results = useMemo(() => {
    const items: Result[] = [...historyResults, ...pages, ...sources.map((source) => ({
      key: `source-${source.id_fonte}`, group: "Fontes pagadoras" as const, title: source.nome_fonte,
      detail: source.codigo_fonte || `Fonte ${source.numero_fonte}`, terms: `${source.nome_fonte} ${source.codigo_fonte ?? ""} ${source.numero_fonte}`,
      area: "sources" as const, sourceId: source.id_fonte,
    }))];
    const term = normalize(query.trim());
    return (term ? items.filter((item) => normalize(`${item.title} ${item.detail} ${item.terms}`).includes(term)) : items.filter((item) => !item.history)).slice(0, 9);
  }, [query, sources, historyResults]);
  const choose = (result: Result) => { onNavigate(result.area, result.sourceId, result.history); onClose(); };
  return <div className="spotlight-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panelRef} className="spotlight-panel" role="dialog" aria-modal="true" aria-label="Busca rápida" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>("input, button") ?? [])];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    }}>
      <div className="spotlight-input-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.1 4.1"/></svg><input ref={inputRef} aria-label="Buscar páginas, fontes, competências ou arquivos" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => results.length ? (current + 1) % results.length : 0); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => results.length ? (current - 1 + results.length) % results.length : 0); }
        if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
      }} placeholder="Buscar páginas, fontes, meses ou arquivos…" /><button type="button" className="spotlight-escape" onClick={onClose} aria-label="Fechar busca">Esc</button></div>
      <div className="spotlight-results" aria-live="polite">{results.length ? results.map((result, index) => <button key={result.key} type="button" className={`spotlight-result${index === active ? " is-active" : ""}`} onMouseEnter={() => setActive(index)} onClick={() => choose(result)}><span className="spotlight-result-icon" aria-hidden="true">{result.group === "Páginas" ? "↗" : result.group === "Competências" ? "▦" : result.group === "Arquivos importados" ? "▤" : "◉"}</span><span><strong>{result.title}</strong><small>{result.detail}</small></span><em>{result.group}</em></button>) : <p className="spotlight-empty">Nenhum resultado encontrado.</p>}</div>
      <footer className="spotlight-footer"><span>↑ ↓ navegar</span><span>↵ abrir</span><span>Esc fechar</span></footer>
    </section>
  </div>;
}
