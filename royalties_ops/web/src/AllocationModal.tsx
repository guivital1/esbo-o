import { useEffect, useRef } from "react";
import { allocationSummary } from "./allocations";
import type { AllocationDraft } from "./allocations";
import type { Source, StatementRow } from "./types";

type Props = {
  row: StatementRow;
  draft: AllocationDraft[];
  sources: Source[];
  sourcesError: string;
  saving?: boolean;
  onChange: (index: number, patch: Partial<AllocationDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const centsMoney = (cents: number) => money.format(cents / 100);

export default function AllocationModal({ row, draft, sources, sourcesError, saving = false, onChange, onAdd, onRemove, onCancel, onConfirm }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const summary = allocationSummary(row, draft, sources);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) { event.preventDefault(); cancelRef.current(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)")]
        .filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return;
      if (event.shiftKey && (!dialog.current.contains(document.activeElement) || document.activeElement === controls[0])) {
        event.preventDefault(); controls.at(-1)?.focus();
      } else if (!event.shiftKey && (!dialog.current.contains(document.activeElement) || document.activeElement === controls.at(-1))) {
        event.preventDefault(); controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return <div className="modal-overlay">
    <section ref={dialog} className="allocation-modal" role="dialog" aria-modal="true" aria-labelledby="allocation-title">
      <header className="modal-header"><div><p className="eyebrow">ALOCAR FONTE</p><h2 id="allocation-title">Desdobrar recebimento</h2></div><button ref={closeButton} className="modal-close" type="button" aria-label="Fechar desdobramento" onClick={onCancel}>×</button></header>
      <div className="modal-original"><div className="original-description"><strong>{row.description}</strong><span>{date.format(new Date(`${row.date}T00:00:00Z`))}</span></div><div className="original-amount"><span>Valor recebido</span><strong>{money.format(Number(row.amount))}</strong></div></div>
      <div className="modal-body"><div className="allocation-columns"><span>Fonte</span><span>Valor</span></div>
        {draft.map((item, at) => <div className="allocation-input-row" key={at}><select aria-label={`Fonte ${at + 1}`} value={item.id_fonte} onChange={(event) => onChange(at, { id_fonte: event.target.value })}><option value="">Selecione uma fonte</option>{sources.filter((source) => source.ativa || source.id_fonte === item.id_fonte).map((source) => <option key={source.id_fonte} value={source.id_fonte}>{source.nome_fonte}{source.ativa ? "" : " (inativa)"}</option>)}</select><div className="money-input"><span>R$</span><input aria-label={`Valor da fonte ${at + 1}`} inputMode="decimal" value={item.amount} onChange={(event) => onChange(at, { amount: event.target.value })} /></div><button className="remove-allocation" type="button" aria-label={`Remover fonte ${at + 1}`} onClick={() => onRemove(at)}>×</button></div>)}
        <button className="text-button add-source" type="button" onClick={onAdd}>＋ Adicionar fonte</button>
        {sourcesError && <p className="operational-error" role="alert">{sourcesError}</p>}
        <div className="allocation-totals"><div><span>Total distribuído</span><strong>{centsMoney(summary.total)}</strong></div><div className={summary.remaining !== 0 ? "remaining-open" : ""}><span>Saldo a distribuir</span><strong>{centsMoney(summary.remaining)}</strong></div></div>
      </div>
      <footer className="allocation-actions"><button className="cancel" type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button className="process" type="button" disabled={!summary.valid || saving} onClick={onConfirm}>{saving ? "Salvando…" : "Confirmar desdobramento"}</button></footer>
    </section>
  </div>;
}
