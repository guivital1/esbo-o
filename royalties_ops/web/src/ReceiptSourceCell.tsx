import type { Source, StatementRow, TransactionAllocation } from "./types";
import { displayedSourceNames } from "./bankTableFilters";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  row: StatementRow;
  allocation?: TransactionAllocation;
  sources: Source[];
  transactionIndex: number;
  onOpen: () => void;
};

export default function ReceiptSourceCell({ row, allocation, sources, transactionIndex, onOpen }: Props) {
  const split = allocation?.status === "split";
  const names = displayedSourceNames(row, allocation, sources);
  const sourceLabel = allocation && split ? `${allocation.allocations.length} fontes` : names[0];
  return <td className="source-cell"><button className="row-expand" type="button" aria-label={`Desdobrar transação ${transactionIndex + 1}`} onClick={onOpen}><span className="chevron" aria-hidden="true">›</span><span>{sourceLabel}</span></button>
    <span className={`row-status ${allocation || !row.review_required ? "identified-status" : ""}`}>{allocation ? split ? "✓ Desdobrado" : "✓ Identificada" : row.review_required ? "Requer revisão" : "✓ Identificada"}</span>
    {split && <div className="source-breakdown" aria-label="Fontes do desdobramento">{allocation.allocations.map((item, at) => <div key={item.id_fonte}><span>{names[at]}</span><span>· {money.format(item.amount_cents / 100)}</span></div>)}</div>}
  </td>;
}
