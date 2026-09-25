import { DragEvent, FormEvent, useEffect, useState } from "react";
import { confirmCatalogCsv, getIngestionBatches, previewCatalogCsv } from "./api";
import type { IngestionBatch, IngestionPreview, ReconciliationView } from "./types";
import { cents, money, monthLabel } from "./reconciliationFormat";
import StatusNotice from "./StatusNotice";

type Props = { reconciliationId: string; period: string; onConfirmed: (batchId: string, view: ReconciliationView) => void;
  onOpenSource?: (id: string) => void; onPreviewOpenChange?: (open: boolean) => void };

// Design Lab never reads uploaded CSV bytes. The preview is always synthetic.
const demoOrigin = "Catálogo CSV";

// The validated CSV preview/confirm flow has one UI implementation.
export default function CatalogImportWorkflow({ reconciliationId, period, onConfirmed, onOpenSource, onPreviewOpenChange }: Props) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<IngestionPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [completedSourceId, setCompletedSourceId] = useState("");
  const [possibleDuplicates, setPossibleDuplicates] = useState<IngestionBatch[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  useEffect(() => {
    onPreviewOpenChange?.(Boolean(preview) && !complete);
  }, [preview, complete, onPreviewOpenChange]);
  useEffect(() => () => onPreviewOpenChange?.(false), [onPreviewOpenChange]);

  const chooseFile = (next?: File) => { setFile(next); setPreview(undefined); setComplete(false); setCompletedSourceId(""); setPossibleDuplicates([]); setDuplicateAcknowledged(false); setError(""); };
  const drop = (event: DragEvent) => {
    event.preventDefault(); setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) void chooseFile(selected);
  };
  const inspect = async (event: FormEvent) => {
    event.preventDefault(); if (!file) return;
    setBusy(true); setError(""); setPreview(undefined); setPossibleDuplicates([]); setDuplicateAcknowledged(false);
    try {
      const nextPreview = await previewCatalogCsv(reconciliationId, file, demoOrigin);
      const priorBatches = await getIngestionBatches(reconciliationId);
      setPossibleDuplicates(priorBatches.filter((batch) => batch.arquivo?.toLocaleLowerCase("pt-BR") === nextPreview.arquivo.toLocaleLowerCase("pt-BR")));
      setPreview(nextPreview);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível validar o CSV."); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!file || !preview?.pode_confirmar || (possibleDuplicates.length > 0 && !duplicateAcknowledged)) return;
    setBusy(true); setError("");
    try {
      const saved = await confirmCatalogCsv(reconciliationId, file, demoOrigin, preview.sha256);
      const sourceNames = [...new Set(preview.linhas.filter((row) => row.situacao === "VALIDA").map((row) => row.fonte))];
      const matching = saved.reconciliation.rows.filter((row) => sourceNames.includes(row.nome_fonte));
      setCompletedSourceId(preview.fontes_afetadas === 1 && matching.length === 1 ? matching[0].id_fonte : "");
      setComplete(true); onConfirmed(saved.batch_id, saved.reconciliation);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível confirmar o CSV."); }
    finally { setBusy(false); }
  };
  const issueCounts = new Map<string, number>();
  for (const row of preview?.linhas ?? []) {
    if (row.situacao !== "BLOQUEADA") continue;
    for (const issue of row.erros.length ? row.erros : ["Erro de validação sem detalhe."]) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  return <section className="catalog-workflow" aria-label="Importar catálogo CSV">
    <div className="catalog-steps" aria-label="Etapas da importação"><span className={!preview && !complete ? "is-active" : "is-complete"}><b>01</b> Arquivo</span><span className={complete ? "is-complete" : preview ? "is-active" : ""}><b>02</b> Conferir</span><span className={complete ? "is-active" : ""}><b>03</b> Finalizar</span></div>
    {complete ? <div className="catalog-complete"><StatusNotice tone="success">Importação concluída. Os lançamentos foram adicionados à conciliação.</StatusNotice><div className="catalog-complete-summary"><span><b>{preview?.linhas_validas}</b> {preview?.linhas_validas === 1 ? "lançamento" : "lançamentos"}</span><span><b>{preview?.artistas_afetados}</b> {preview?.artistas_afetados === 1 ? "artista" : "artistas"}</span><span><b>{money(preview?.valor_total_valido ?? "0.00")}</b> conciliados</span></div><div className="catalog-complete-actions">{completedSourceId && onOpenSource && <button type="button" className="process" onClick={() => onOpenSource(completedSourceId)}>Ver na operação</button>}<button type="button" className="source-action" onClick={() => void chooseFile(undefined)}>Importar outro arquivo</button></div></div>
      : <form onSubmit={inspect}>{!preview && <div className="catalog-workflow-body"><div className="catalog-workflow-fields">
        <div className="catalog-stage-heading"><p className="eyebrow">ETAPA 1 DE 3 · ARQUIVO</p><h2>Selecione o catálogo</h2><p>Confira as linhas antes de importar os valores para a conciliação.</p></div>
        <label className={`catalog-drop-zone ${dragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <svg className="catalog-drop-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="5"/><path d="M11 12h10M11 17h10M11 22h6"/></svg>
          <strong>{file?.name || "Arraste seu CSV aqui"}</strong><span>{file ? "Arquivo selecionado. Clique para trocar." : "ou selecione um arquivo do computador"}</span><small>Formato CSV · UTF-8</small><span className="catalog-file-choice">{file ? "Trocar arquivo" : "Selecionar CSV"}</span><input type="file" accept=".csv,text/csv" required={!file} onChange={(event) => void chooseFile(event.target.files?.[0])} /></label>
      </div><aside className="catalog-guide" aria-label="Orientações de importação"><span className="catalog-guide-kicker">PARA CONFERIR</span><h3>Modelo e exemplo</h3><p>O CSV deve trazer fonte, artista, data, referência e valor. Você verá as linhas aceitas e os erros antes de confirmar.</p><div className="catalog-guide-divider" /><a className="catalog-template-link" href="/modelo_ingestao_catalogo_v1.csv" download>Baixar modelo CSV <span aria-hidden="true">↗</span></a><button type="button" className="catalog-demo-button" onClick={() => void chooseFile(new File([], "catalogo_ficticio_demo.csv", { type: "text/csv" }))}>Usar CSV fictício <span aria-hidden="true">→</span></button></aside></div>}
      {busy && <StatusNotice tone="loading">{preview ? "Importando lançamentos…" : "Conferindo arquivo…"}</StatusNotice>}
      {error && <StatusNotice tone="error">{error}</StatusNotice>}
      {preview && <div className="catalog-preview" aria-label="Prévia da importação"><div className="catalog-preview-title"><div><p className="eyebrow">ETAPA 2 DE 3 · CONFERIR</p><h3>{preview.arquivo}</h3></div>{preview.warnings > 0 && <span>{preview.warnings} {preview.warnings === 1 ? "aviso" : "avisos"}</span>}</div>
        <div className="catalog-preview-summary"><div><small>Linhas válidas</small><strong>{preview.linhas_validas}</strong></div><div><small>Linhas com erro</small><strong>{preview.linhas_bloqueadas}</strong></div><div><small>Artistas</small><strong>{preview.artistas_afetados}</strong></div><div><small>Valor válido</small><strong>{money(preview.valor_total_valido)}</strong></div></div>
        <div className={`catalog-review-notice ${!preview.pode_confirmar || preview.linhas_bloqueadas ? "has-errors" : ""}`} role="status"><strong>{!preview.pode_confirmar ? "Arquivo ainda não pode ser importado" : preview.linhas_bloqueadas ? `${preview.linhas_bloqueadas} ${preview.linhas_bloqueadas === 1 ? "linha com erro ficará" : "linhas com erro ficarão"} fora da importação` : "Arquivo pronto para importar"}</strong><p>{preview.pode_confirmar ? `${preview.linhas_validas} ${preview.linhas_validas === 1 ? "linha válida será importada" : "linhas válidas serão importadas"}. ${preview.linhas_bloqueadas ? "Confira os erros abaixo ou troque o arquivo para corrigi-los." : "Revise os valores antes de confirmar."}` : "Confira os problemas abaixo, corrija o arquivo e gere uma nova prévia."}</p></div>
        {possibleDuplicates.length > 0 && <section className="catalog-duplicate-warning" aria-label="Possível importação duplicada"><strong>Possível reimportação nesta competência</strong><p>Já existe {possibleDuplicates.length === 1 ? "um envio" : `${possibleDuplicates.length} envios`} com o nome <b>{preview.arquivo}</b> em {monthLabel(period)}. Compare antes de confirmar.</p><div className="catalog-duplicate-comparison"><span>Prévia atual <b>{money(preview.valor_total_valido)}</b></span>{possibleDuplicates.map((batch) => <span key={batch.id}>Envio de {new Date(batch.importado_em).toLocaleDateString("pt-BR")} <b>{money(batch.valor_total)}</b> · {cents(batch.valor_total) === cents(preview.valor_total_valido) ? "mesmo valor" : "valor diferente"}</span>)}</div><label><input type="checkbox" checked={duplicateAcknowledged} onChange={(event) => setDuplicateAcknowledged(event.target.checked)} /> Conferi os envios anteriores e quero continuar com esta importação demonstrativa.</label><small>O nome igual é apenas um alerta; a regra oficial para reenvio ou substituição ainda será definida.</small></section>}
        {preview.erros.map((message, index) => <StatusNotice tone="error" key={index}>{message}</StatusNotice>)}
        {issueCounts.size > 0 && <section className="catalog-issues" aria-label="Problemas encontrados"><h4>O que corrigir no arquivo</h4><ul>{[...issueCounts].map(([message, count]) => <li key={message}><span>{message}</span><small>{count} {count === 1 ? "ocorrência" : "ocorrências"}</small></li>)}</ul></section>}
      </div>}
      <footer className="catalog-workflow-actions">{preview ? <><button type="button" className="source-action" onClick={() => { setPreview(undefined); setPossibleDuplicates([]); setDuplicateAcknowledged(false); }}>Trocar arquivo</button><button type="button" className="process" disabled={busy || !preview.pode_confirmar || (possibleDuplicates.length > 0 && !duplicateAcknowledged)} onClick={confirm}>{busy ? "Importando…" : `Importar ${preview.linhas_validas} ${preview.linhas_validas === 1 ? "linha válida" : "linhas válidas"}`}</button></> : <button type="submit" className="process" disabled={busy || !file}>{busy ? "Conferindo…" : "Gerar prévia"}</button>}</footer></form>}
  </section>;
}
