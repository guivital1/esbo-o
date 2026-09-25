import { useEffect, useMemo, useState } from "react";
import { getBankIdentifications, setSourceActive } from "./api";
import { bankLabel, filterSources, identificationsForSource } from "./sourceCatalog";
import type { SourceStatusFilter } from "./sourceCatalog";
import type { BankIdentification, Source } from "./types";
import SourcesTable from "./SourcesTable";
import SourceDetails from "./SourceDetails";
import CreateSourceModal from "./CreateSourceModal";
import EditSourceModal from "./EditSourceModal";
import AddIdentificationModal from "./AddIdentificationModal";
import StatusNotice from "./StatusNotice";
import { onTabArrowKey } from "./keyboardTabs";

type Props = { sources: Source[]; loading: boolean; error: string; openRequest?: { id: string; key: number };
  onSourceCreated: (source: Source) => void; onSourceSaved: (source: Source) => void };

export default function SourcesPage({ sources, loading, error, openRequest, onSourceCreated, onSourceSaved }: Props) {
  const [section, setSection] = useState<"catalog" | "bank">("catalog");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SourceStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"details" | "edit" | "identification" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState("");
  const [identifications, setIdentifications] = useState<BankIdentification[]>([]);
  const [identificationsLoading, setIdentificationsLoading] = useState(true);
  const [identificationsError, setIdentificationsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getBankIdentifications(controller.signal).then(setIdentifications).catch((reason) => {
      if (!controller.signal.aborted) setIdentificationsError(reason instanceof Error ? reason.message : "Não foi possível carregar as identificações bancárias.");
    }).finally(() => { if (!controller.signal.aborted) setIdentificationsLoading(false); });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => filterSources(sources, query, status), [sources, query, status]);
  const selected = sources.find((source) => source.id_fonte === selectedId);
  const names = useMemo(() => new Map(sources.map((source) => [source.id_fonte, source.nome_fonte])), [sources]);
  const openDetails = (id: string) => { setSelectedId(id); setActionError(""); setDialog("details"); };
  useEffect(() => {
    if (!openRequest) return;
    setSection("catalog"); setQuery(""); setStatus("all"); openDetails(openRequest.id);
  }, [openRequest]);
  const toggleSource = async () => {
    if (!selected || actionBusy) return;
    const verb = selected.ativa ? "inativar" : "ativar";
    if (!window.confirm(`Deseja ${verb} ${selected.nome_fonte}?`)) return;
    setActionBusy(true); setActionError("");
    try {
      const updated = await setSourceActive(selected.id_fonte, !selected.ativa);
      onSourceSaved(updated);
      setDialog(null); setSelectedId(null);
      setSuccess(`Fonte “${updated.nome_fonte}” ${updated.ativa ? "ativada" : "inativada"} com sucesso.`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Não foi possível alterar a fonte."); }
    finally { setActionBusy(false); }
  };
  const identificationSaved = (item: BankIdentification) => {
    setIdentifications((current) => [...current, item]);
    getBankIdentifications().then(setIdentifications).catch(() => { /* A resposta do POST já contém a identificação salva. */ });
    setDialog("details");
    setSuccess("Identificação bancária adicionada com sucesso.");
  };

  return <div className="sources-page"><header className="sources-appbar"><h1>Fontes pagadoras</h1><button type="button" className="process" onClick={() => { setSuccess(""); setCreating(true); }}>Nova fonte <span aria-hidden="true">+</span></button></header>
    {success && <StatusNotice tone="success" className="sources-notice">{success}</StatusNotice>}
    <div className="source-tabs" role="tablist" aria-label="Seções de fontes pagadoras" onKeyDown={onTabArrowKey}><button type="button" role="tab" tabIndex={section === "catalog" ? 0 : -1} aria-selected={section === "catalog"} onClick={() => setSection("catalog")}>Cadastro</button><button type="button" role="tab" tabIndex={section === "bank" ? 0 : -1} aria-selected={section === "bank"} onClick={() => setSection("bank")}>Identificação bancária</button></div>
    {section === "catalog" ? <><section className="table-section"><div className="table-toolbar"><span className="sources-result-count">{visible.length} de {sources.length} fontes</span><div className="source-filters"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou código" aria-label="Buscar fontes" /></label><label className="source-filter-label">Status<select aria-label="Filtrar status" value={status} onChange={(event) => setStatus(event.target.value as SourceStatusFilter)}><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></label></div></div>
      {loading ? <StatusNotice tone="loading" className="sources-table-notice">Carregando fontes…</StatusNotice> : error ? <StatusNotice tone="error" className="sources-table-notice">{error}</StatusNotice> : <SourcesTable sources={visible} onDetails={openDetails} />}</section>
      {selected && dialog === "details" && <SourceDetails source={selected} identifications={identificationsForSource(identifications, selected.id_fonte)} loading={identificationsLoading} error={identificationsError} onClose={() => setDialog(null)} onEdit={() => setDialog("edit")} onToggle={toggleSource} onAddIdentification={() => setDialog("identification")} actionBusy={actionBusy} actionError={actionError} />}
      {selected && dialog === "edit" && <EditSourceModal source={selected} onClose={() => setDialog("details")} onSaved={(updated) => { onSourceSaved(updated); setDialog("details"); setSuccess("Fonte atualizada com sucesso."); }} />}
      {selected && dialog === "identification" && <AddIdentificationModal source={selected} onClose={() => setDialog("details")} onSaved={identificationSaved} />}</> : <section className="table-section"><div className="table-toolbar"><span className="sources-result-count">{identifications.length} identificações bancárias</span></div>
      {identificationsLoading ? <StatusNotice tone="loading" className="sources-table-notice">Carregando identificações…</StatusNotice> : identificationsError ? <StatusNotice tone="error" className="sources-table-notice">{identificationsError}</StatusNotice> : <div className="table-wrap"><table className="identifications-table"><thead><tr><th>Banco</th><th>Identificação bancária</th><th>Fonte vinculada</th></tr></thead><tbody>{identifications.map((item) => <tr key={`${item.bank}:${item.kind}:${item.value}`}><td>{bankLabel(item.bank)}</td><td>{item.value}</td><td>{names.get(item.id_fonte) ?? "Fonte indisponível"}</td></tr>)}</tbody></table>{identifications.length === 0 && <p className="empty">Nenhuma identificação bancária vinculada.</p>}</div>}</section>}
    {creating && <CreateSourceModal onClose={() => setCreating(false)} onCreated={(source) => { onSourceCreated(source); setCreating(false); setSuccess(`Fonte “${source.nome_fonte}” criada com sucesso.`); }} />}
  </div>;
}
