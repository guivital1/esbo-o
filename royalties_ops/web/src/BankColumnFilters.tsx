import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BankFilters } from "./bankTableFilters";

type Column = "date" | "description" | "source" | "value";
type Props = { filters: BankFilters; onChange: (patch: Partial<BankFilters>) => void; sourceOptions: string[] };
const labels: Record<Column, string> = { date: "Data", description: "Descrição", source: "Fonte pagadora", value: "Valor" };

export default function BankColumnFilters({ filters, onChange, sourceOptions }: Props) {
  const [open, setOpen] = useState<Column | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [sourceSearch, setSourceSearch] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!panel.current?.contains(target) && !target.closest("[data-column-filter-trigger]")) setOpen(null);
    };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    const dismiss = (event: Event) => { if (!panel.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", dismiss); window.removeEventListener("scroll", dismiss, true); };
  }, [open]);

  const active: Record<Column, boolean> = {
    date: Boolean(filters.dateFrom || filters.dateTo),
    description: Boolean(filters.description.trim()),
    source: filters.sourceNames !== null,
    value: Boolean(filters.valueMin || filters.valueMax || filters.valueOrder !== "none"),
  };
  const button = (column: Column) => <button type="button" data-column-filter-trigger="" className={`column-filter-trigger ${active[column] ? "is-filtered" : ""}`}
    aria-label={`Filtrar ${labels[column]}`} aria-expanded={open === column} onClick={(event) => {
      if (open === column) { setOpen(null); return; }
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
        top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 345)) });
      setOpen(column);
    }}>▾</button>;
  const selected = filters.sourceNames === null ? new Set(sourceOptions) : new Set(filters.sourceNames);
  const toggleSource = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange({ sourceNames: next.size === sourceOptions.length ? null : [...next] });
  };
  const found = sourceOptions.filter((name) => name.toLocaleLowerCase("pt-BR").includes(sourceSearch.trim().toLocaleLowerCase("pt-BR")));

  return <><tr className="bank-filter-head">
    {(["date", "description", "source", "value"] as Column[]).map((column) => <th key={column} className={column === "value" ? "amount" : ""}><span>{labels[column]}</span>{button(column)}</th>)}
  </tr>
    {open && createPortal(<div ref={panel} className="column-filter-panel" role="group" aria-label={`Filtro de ${labels[open]}`} style={position}>
      <strong className="filter-title">{labels[open]}</strong>
      {open === "date" && <div className="filter-fields"><label>De<input type="date" aria-label="Data inicial" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} /></label><label>Até<input type="date" aria-label="Data final" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} /></label></div>}
      {open === "description" && <div className="filter-fields"><label>Contém<input type="search" aria-label="Buscar descrição" value={filters.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Buscar na descrição" /></label></div>}
      {open === "source" && <><input type="search" aria-label="Buscar no filtro de fontes" value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Buscar fonte" /><div className="filter-quick-actions"><button type="button" onClick={() => onChange({ sourceNames: null })}>Selecionar tudo</button><button type="button" onClick={() => onChange({ sourceNames: [] })}>Desmarcar tudo</button></div><div className="source-filter-options">{found.map((name) => <label key={name}><input type="checkbox" checked={selected.has(name)} onChange={() => toggleSource(name)} />{name}</label>)}{found.length === 0 && <p>Nenhuma fonte encontrada.</p>}</div></>}
      {open === "value" && <div className="filter-fields"><label>Mínimo (R$)<input type="number" step="0.01" aria-label="Valor mínimo" value={filters.valueMin} onChange={(event) => onChange({ valueMin: event.target.value })} /></label><label>Máximo (R$)<input type="number" step="0.01" aria-label="Valor máximo" value={filters.valueMax} onChange={(event) => onChange({ valueMax: event.target.value })} /></label><label>Ordenar<select aria-label="Ordenar valor" value={filters.valueOrder} onChange={(event) => onChange({ valueOrder: event.target.value as BankFilters["valueOrder"] })}><option value="none">Sem ordenação</option><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label></div>}
      <div className="filter-footer"><button type="button" onClick={() => { onChange(open === "date" ? { dateFrom: "", dateTo: "" } : open === "description" ? { description: "" } : open === "source" ? { sourceNames: null } : { valueMin: "", valueMax: "", valueOrder: "none" }); }}>Limpar coluna</button><button type="button" onClick={() => setOpen(null)}>Concluir</button></div>
    </div>, document.body)}
  </>;
}
