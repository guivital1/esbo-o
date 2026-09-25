import { useState } from "react";
import type { FormEvent } from "react";
import { updateSource } from "./api";
import type { Source } from "./types";
import SourceModal from "./SourceModal";
import StatusNotice from "./StatusNotice";

type Props = { source: Source; onClose: () => void; onSaved: (source: Source) => void };

export default function EditSourceModal({ source, onClose, onSaved }: Props) {
  const [name, setName] = useState(source.nome_fonte);
  const [code, setCode] = useState(source.codigo_fonte ?? "");
  const [type, setType] = useState(source.tipo_fonte ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const trimmedName = name.trim(), trimmedCode = code.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) { setError("Informe o nome e o código da fonte."); return; }
    if (!/^[A-Z0-9_]+$/.test(trimmedCode)) { setError("O código aceita apenas letras, números e sublinhado."); return; }
    setSaving(true); setError("");
    try {
      const updated = await updateSource(source.id_fonte, { nome_fonte: trimmedName, codigo_fonte: trimmedCode, tipo_fonte: type.trim() || null });
      onSaved(updated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a fonte."); }
    finally { setSaving(false); }
  };

  return <SourceModal title="Editar fonte" onClose={onClose} busy={saving} initialFocus="input">
    <form className="source-edit-form" onSubmit={submit}>
      <div className="source-modal-body source-form-fields">
        <label>Nome da fonte<input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Código da fonte<input required maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <label>Tipo (opcional)<input maxLength={100} value={type} onChange={(event) => setType(event.target.value)} /></label>
        {error && <StatusNotice tone="error">{error}</StatusNotice>}
      </div>
      <footer className="source-modal-actions"><button className="cancel" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="process" type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button></footer>
    </form>
  </SourceModal>;
}
