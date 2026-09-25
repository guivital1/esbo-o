import { useState } from "react";
import type { FormEvent } from "react";
import { createBankIdentification } from "./api";
import type { BankIdentification, Source } from "./types";
import SourceModal from "./SourceModal";
import StatusNotice from "./StatusNotice";

type Props = { source: Source; onClose: () => void; onSaved: (item: BankIdentification) => void };
type Bank = "safra" | "btg";
type Kind = "payor_alias" | "description" | "document";

export default function AddIdentificationModal({ source, onClose, onSaved }: Props) {
  const [bank, setBank] = useState<Bank>("safra");
  const [kind, setKind] = useState<Kind>("payor_alias");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const text = value.trim();
    if (!text) { setError("Informe o texto da identificação bancária."); return; }
    setSaving(true); setError("");
    try {
      onSaved(await createBankIdentification({ id_fonte: source.id_fonte, bank, kind, value: text }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Não foi possível salvar a identificação.";
      setError(message.includes("identificação ativa") ? "Esta identificação já está cadastrada para esse banco e tipo. Revise antes de salvar." : message);
    } finally { setSaving(false); }
  };

  return <SourceModal title="Adicionar identificação" onClose={onClose} busy={saving} initialFocus="select">
    <form className="source-identification-form" onSubmit={submit}>
      <div className="source-modal-body source-form-fields">
        <p className="source-form-context">Fonte vinculada: <strong>{source.nome_fonte}</strong></p>
        <label>Banco<select value={bank} onChange={(event) => { const next = event.target.value as Bank; setBank(next); setKind(next === "btg" ? "description" : "payor_alias"); }}><option value="safra">Safra</option><option value="btg">BTG Pactual</option></select></label>
        <label>Onde aparece<select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>{bank === "safra" ? <><option value="payor_alias">Nome do pagador</option><option value="document">Documento</option></> : <option value="description">Descrição do extrato</option>}</select></label>
        <label>Identificação bancária<input required maxLength={500} value={value} onChange={(event) => setValue(event.target.value)} /></label>
        {error && <StatusNotice tone="error">{error}</StatusNotice>}
      </div>
      <footer className="source-modal-actions"><button className="cancel" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="process" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button></footer>
    </form>
  </SourceModal>;
}
