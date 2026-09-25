import type { Source } from "./types";
import { displaySourceNumber } from "./sourceCatalog";

type Props = { sources: Source[]; onDetails: (id: string) => void };

export default function SourcesTable({ sources, onDetails }: Props) {
  return <div className="table-wrap"><table className="sources-table"><thead><tr><th>ID</th><th>Código</th><th>Fonte pagadora</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead><tbody>
    {sources.map((source) => <tr key={source.id_fonte}>
      <td data-label="ID" className="source-number">{displaySourceNumber(source.numero_fonte)}</td><td data-label="Código"><code>{source.codigo_fonte ?? "Pendente"}</code></td><td data-label="Fonte pagadora"><strong>{source.nome_fonte}</strong></td><td data-label="Tipo">{source.tipo_fonte ?? "—"}</td>
      <td data-label="Status"><span className={`source-status ${source.ativa ? "is-active" : "is-inactive"}`}>{source.ativa ? "Ativa" : "Inativa"}</span></td>
      <td data-label="Ações"><button type="button" className="source-action" onClick={() => onDetails(source.id_fonte)} aria-label={`Ver detalhes de ${source.nome_fonte}`}>Detalhes</button></td>
    </tr>)}
  </tbody></table>{sources.length === 0 && <p className="empty">Nenhuma fonte encontrada.</p>}</div>;
}
