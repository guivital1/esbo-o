import type { BankIdentification, Source } from "./types";
import { bankLabel, displaySourceNumber } from "./sourceCatalog";
import SourceModal from "./SourceModal";
import StatusNotice from "./StatusNotice";

type Props = { source: Source; identifications: BankIdentification[]; loading: boolean; error: string; onClose: () => void; onEdit: () => void; onToggle: () => void; onAddIdentification: () => void; actionBusy: boolean; actionError: string };

export default function SourceDetails({ source, identifications, loading, error, onClose, onEdit, onToggle, onAddIdentification, actionBusy, actionError }: Props) {
  const fixture = source.nome_fonte === "Fonte HM Fixture";
  return <SourceModal title="Detalhes da fonte" onClose={onClose} busy={actionBusy}>
    <div className="source-modal-body source-details">
      <dl className="source-fields">
        <div><dt>ID da fonte</dt><dd className="source-id">{displaySourceNumber(source.numero_fonte)}</dd></div>
        <div><dt>Nome da fonte</dt><dd>{source.nome_fonte}</dd></div>
        <div><dt>Código da fonte</dt><dd>{source.codigo_fonte ?? "Pendente"}</dd></div>
        {source.tipo_fonte && <div><dt>Tipo</dt><dd>{source.tipo_fonte}</dd></div>}
      </dl>
      <div className="source-identification-heading"><h3>Identificações bancárias vinculadas</h3><button type="button" className="source-action" disabled={fixture || actionBusy} onClick={onAddIdentification}>+ Adicionar identificação</button></div>
      {loading ? <StatusNotice tone="loading">Carregando identificações…</StatusNotice> : error ? <StatusNotice tone="error">{error}</StatusNotice> : identifications.length ?
        <div className="source-identifications">{identifications.map((item) => <div className="source-identification" key={`${item.bank}:${item.kind}:${item.value}`}>
          <div><span>Banco</span><strong>{bankLabel(item.bank)}</strong></div>
          <div><span>Identificação bancária</span><strong>{item.value}</strong></div>
          <div><span>Fonte vinculada</span><strong>{source.nome_fonte}</strong></div>
        </div>)}</div> : <p className="source-help">Nenhuma identificação bancária vinculada.</p>}
      {actionError && <StatusNotice tone="error">{actionError}</StatusNotice>}
      <div className="source-detail-actions"><button type="button" className="source-action" disabled={fixture || actionBusy} onClick={onEdit}>Editar</button><button type="button" className="source-action" disabled={fixture || actionBusy} onClick={onToggle}>{actionBusy ? "Salvando…" : source.ativa ? "Inativar" : "Ativar"}</button></div>
    </div>
  </SourceModal>;
}
