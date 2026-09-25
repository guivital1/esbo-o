import { useState } from "react";
import type { FormEvent } from "react";
import { createSource } from "./api";
import type { Source } from "./types";
import SourceModal from "./SourceModal";
import StatusNotice from "./StatusNotice";

type Props = { onClose: () => void; onCreated: (source: Source) => void };

export default function CreateSourceModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) { setError("Informe o nome e o código da fonte."); return; }
    if (!/^[A-Z0-9_]+$/.test(trimmedCode)) { setError("O código aceita apenas letras, números e sublinhado."); return; }
    setSaving(true); setError("");
    try {
      const created = await createSource({ nome_fonte: trimmedName, codigo_fonte: trimmedCode, tipo_fonte: type.trim() || null });
      onCreated(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a fonte. Tente novamente.");
    } finally { setSaving(false); }
  };

  return <SourceModal title="Nova fonte" onClose={onClose} busy={saving} initialFocus="input">
    <form className="source-create-form" onSubmit={submit}>
      <div className="source-modal-body source-form-fields">
        <label>Nome da fonte<input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Código da fonte<input required maxLength={100} autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex.: EDITORA_EXEMPLO" /></label>
        <label>Tipo (opcional)<input maxLength={100} value={type} onChange={(event) => setType(event.target.value)} /></label>
        {error && <StatusNotice tone="error">{error}</StatusNotice>}
      </div>
      <footer className="source-modal-actions"><button className="cancel" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="process" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button></footer>
    </form>
  </SourceModal>;
}
