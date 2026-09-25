import { useEffect, useState } from "react";
import { getSources } from "./api";
import type { Source } from "./types";
import SourcesPage from "./SourcesPage";
import BankStatementsPage from "./BankStatementsPage";
import ReconciliationPage from "./ReconciliationPage";
import type { ReconciliationSection } from "./ReconciliationPage";
import Spotlight from "./Spotlight";
import type { HistorySearchTarget, SearchArea } from "./Spotlight";
import type { SessionAction, SessionNote } from "./sessionNotes";

type Area = "bank" | "sources" | ReconciliationSection;
type NavigationTarget = { area: Area; sourceId?: string; history?: HistorySearchTarget; bankStatementId?: string; transactionIndex?: number; resetBank?: boolean };
const initialPeriod = () => {
  const now = new Date(); const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
};

function NavIcon({ name }: { name: Area | "automation" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
    {name === "bank" && <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>}
    {name === "sources" && <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 6V4h8v2M8 11h2m4 0h2m-8 4h2m4 0h2" /></>}
    {name === "overview" && <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 16v-4m3 4V8m3 8v-6" /></>}
    {name === "operation" && <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="#fff" /><circle cx="15" cy="12" r="2" fill="#fff" /><circle cx="11" cy="17" r="2" fill="#fff" /></>}
    {name === "import" && <><path d="M12 4v10m-4-4 4 4 4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>}
    {name === "automation" && <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /><path d="M11 7h5a2 2 0 0 1 2 2v4M13 17H8a2 2 0 0 1-2-2v-4" /></>}
  </svg>;
}

type Props = { spotlightOpen: boolean; onCloseSpotlight: () => void };
export default function App({ spotlightOpen, onCloseSpotlight }: Props) {
  const [area, setArea] = useState<Area>("bank");
  const [reconciliationEntity, setReconciliationEntity] = useState<"HM" | "MDB">("MDB");
  const [reconciliationPeriod, setReconciliationPeriod] = useState(initialPeriod);
  const [reconciliationStatementId, setReconciliationStatementId] = useState("");
  const [reconciliationSourceId, setReconciliationSourceId] = useState("");
  const [operationFilter, setOperationFilter] = useState<"all" | "action" | "mine" | "unidentified">("all");
  const [operationQuery, setOperationQuery] = useState("");
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  const [operationDraftDirty, setOperationDraftDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<NavigationTarget>();
  const [bankHistoryRequest, setBankHistoryRequest] = useState(0);
  const [bankOpenRequest, setBankOpenRequest] = useState<{ statementId: string; transactionIndex?: number; key: number }>();
  const [automationPreviewOpen, setAutomationPreviewOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState("");
  const [sourceOpenRequest, setSourceOpenRequest] = useState<{ id: string; key: number }>();
  const [historyOpenRequest, setHistoryOpenRequest] = useState<(HistorySearchTarget & { key: number })>();
  useEffect(() => {
    const controller = new AbortController();
    getSources(controller.signal).then(setSources)
      .catch((reason) => { if (!controller.signal.aborted) setSourcesError(reason instanceof Error ? reason.message : "Não foi possível carregar as fontes."); })
      .finally(() => { if (!controller.signal.aborted) setSourcesLoading(false); });
    return () => controller.abort();
  }, []);
  const sourceSaved = (saved: Source) => {
    setSources((current) => current.some((source) => source.id_fonte === saved.id_fonte)
      ? current.map((source) => source.id_fonte === saved.id_fonte ? saved : source) : [...current, saved]);
    setSourcesError("");
  };
  const sourceCreated = (created: Source) => {
    sourceSaved(created);
    getSources().then(setSources).catch(() => { /* POST já contém a fonte salva. */ });
  };
  const commitNavigation = (target: NavigationTarget) => {
    setArea(target.area);
    setSourceOpenRequest(target.sourceId ? { id: target.sourceId, key: Date.now() } : undefined);
    setHistoryOpenRequest(target.history ? { ...target.history, key: Date.now() } : undefined);
    setBankOpenRequest(target.bankStatementId ? { statementId: target.bankStatementId, transactionIndex: target.transactionIndex, key: Date.now() } : undefined);
    if (target.resetBank) setBankHistoryRequest((value) => value + 1);
    setAutomationPreviewOpen(false);
  };
  const navigate = (target: NavigationTarget) => {
    if (operationDraftDirty && area === "operation" && target.area !== "operation") { setPendingNavigation(target); return; }
    commitNavigation(target);
  };
  const navigateFromSpotlight = (next: SearchArea, sourceId?: string, history?: HistorySearchTarget) => {
    navigate({ area: next, sourceId, history });
  };
  return <div className={`shell ${area === "overview" ? "shell--overview" : area === "import" ? "shell--import" : area === "sources" ? "shell--sources" : ""}`}>
    <aside className="sidebar"><div className="brand"><img className="brand-mark" src="/muv-logo.png" alt="" /><strong>MUV Royalties</strong></div>
      <nav aria-label="Navegação principal"><span className="nav-section">Importações</span>
        <button type="button" className={area === "bank" ? "nav-active" : "nav-link"} aria-current={area === "bank" ? "page" : undefined} onClick={() => navigate({ area: "bank", resetBank: true })}><NavIcon name="bank" /> Histórico de extratos</button>
        <button type="button" className={area === "sources" ? "nav-active" : "nav-link"} aria-current={area === "sources" ? "page" : undefined} onClick={() => navigate({ area: "sources" })}><NavIcon name="sources" /> Fontes pagadoras</button>
        <span className="nav-section">Conciliação</span>
        {([ ["overview", "Visão geral"], ["operation", "Operação"], ["import", "Importar dados"] ] as const).map(([key, label]) =>
          <button key={key} type="button" className={area === key ? "nav-active" : "nav-link"} aria-current={area === key ? "page" : undefined} onClick={() => navigate({ area: key })}><NavIcon name={key} /> {label}</button>)}
        <span className="nav-section">Aplicativos</span>
        <button type="button" className={`nav-link automation-link${automationPreviewOpen ? " is-preview-open" : ""}`} aria-expanded={automationPreviewOpen} aria-controls="automation-link-preview" onClick={() => setAutomationPreviewOpen((open) => !open)}>
          <NavIcon name="automation" /> Automação <svg className="automation-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
        {automationPreviewOpen && <div className="automation-preview" id="automation-link-preview">
          <div className="automation-preview-title"><span className="automation-preview-mark"><NavIcon name="automation" /></span><div><strong>Automação</strong><small>Aplicativo da empresa</small></div></div>
          <div className="automation-preview-route"><span>MUV Royalties</span><span aria-hidden="true">↔</span><b>Automação</b></div>
          <p>Automação é um aplicativo separado. O acesso externo está indisponível nesta prévia.</p>
          <button type="button" className="automation-back" onClick={() => navigate({ area: "overview" })}>Ir à Visão geral <span aria-hidden="true">→</span></button>
        </div>}
      </nav>
      </aside>
    <main className={`content ${area === "overview" ? "content--overview" : area === "import" ? "content--import" : area === "sources" ? "content--sources" : ""}`}>
      <div hidden={area !== "bank"}><BankStatementsPage key={bankHistoryRequest} sources={sources} sourcesError={sourcesError} openRequest={bankOpenRequest} /></div>
      {area === "sources" && <SourcesPage sources={sources} loading={sourcesLoading} error={sourcesError} openRequest={sourceOpenRequest} onSourceCreated={sourceCreated} onSourceSaved={sourceSaved} />}
      {(area === "overview" || area === "operation" || area === "import") &&
        <ReconciliationPage section={area} onSectionChange={(section) => navigate({ area: section })} onReviewBankStatement={(id, transactionIndex) => navigate({ area: "bank", bankStatementId: id, transactionIndex })} entity={reconciliationEntity} onEntityChange={setReconciliationEntity} period={reconciliationPeriod} onPeriodChange={setReconciliationPeriod} statementId={reconciliationStatementId} onStatementChange={setReconciliationStatementId} selectedSourceId={reconciliationSourceId} onSelectedSourceChange={setReconciliationSourceId} operationFilter={operationFilter} onOperationFilterChange={setOperationFilter} operationQuery={operationQuery} onOperationQueryChange={setOperationQuery} onOperationDraftDirtyChange={setOperationDraftDirty} sessionNotes={sessionNotes} onAddSessionNote={(note) => setSessionNotes((current) => [note, ...current])} sessionActions={sessionActions} onAddSessionAction={(action) => setSessionActions((current) => [action, ...current])} sources={sources} sourcesError={sourcesError} historyOpenRequest={historyOpenRequest} />}
    </main>
    {pendingNavigation && <div className="draft-navigation-backdrop"><section className="draft-navigation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="draft-navigation-title" aria-describedby="draft-navigation-description"><h2 id="draft-navigation-title">Lançamento não confirmado</h2><p id="draft-navigation-description">Sair da Operação descartará os campos preenchidos neste lançamento.</p><div><button type="button" onClick={() => setPendingNavigation(undefined)}>Continuar preenchendo</button><button type="button" onClick={() => { const target = pendingNavigation; setPendingNavigation(undefined); setOperationDraftDirty(false); commitNavigation(target); }}>Descartar e sair</button></div></section></div>}
    {spotlightOpen && <Spotlight sources={sources} onClose={onCloseSpotlight} onNavigate={navigateFromSpotlight} />}
  </div>;
}
