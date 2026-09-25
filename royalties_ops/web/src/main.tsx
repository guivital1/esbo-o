import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import KeyboardHelp from "./KeyboardHelp";
import "./styles.css";

function DesignLab() {
  const [signedIn, setSignedIn] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const helpReturnFocus = useRef<HTMLElement>(null);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault(); setProfileOpen(false); setKeyboardHelpOpen(false); setSpotlightOpen((open) => !open);
      }
      if (event.key === "?" && signedIn && !keyboardHelpOpen && !spotlightOpen &&
          !(event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest("input, textarea, select"))) &&
          !document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) {
        event.preventDefault(); helpReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setProfileOpen(false); setKeyboardHelpOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [keyboardHelpOpen, signedIn, spotlightOpen]);
  const closeSpotlight = () => { setSpotlightOpen(false); searchTriggerRef.current?.focus(); };
  const closeKeyboardHelp = () => { setKeyboardHelpOpen(false); requestAnimationFrame(() => helpReturnFocus.current?.focus()); };

  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setProfileOpen(false); profileTriggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [profileOpen]);

  return <>
    {signedIn && <a className="skip-to-content" href="#main-content">Ir para o conteúdo</a>}
    {signedIn && <header className="design-lab-bar">
        <button ref={searchTriggerRef} type="button" className="spotlight-trigger" aria-label="Abrir busca rápida" aria-keyshortcuts="Meta+K Control+K" onClick={() => { setProfileOpen(false); setSpotlightOpen(true); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.1 4.1"/></svg><span>Buscar</span><kbd>⌘ K</kbd></button>
        <button type="button" className="keyboard-help-trigger" aria-label="Ver atalhos de teclado" aria-keyshortcuts="?" onClick={(event) => { helpReturnFocus.current = event.currentTarget; setProfileOpen(false); setSpotlightOpen(false); setKeyboardHelpOpen(true); }}>Atalhos <kbd>?</kbd></button>
        <div className="profile-menu" ref={profileRef}>
          <button ref={profileTriggerRef} type="button" className="profile-trigger" aria-haspopup="menu" aria-expanded={profileOpen} aria-controls="profile-options" onClick={() => setProfileOpen((open) => !open)}>
            <span className="profile-avatar" aria-hidden="true">GV</span>
            <span className="profile-label"><strong>Guilherme Vital</strong><small>Estagiário de Backoffice</small></span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button>
          {profileOpen && <div className="profile-popover" id="profile-options" role="menu" aria-label="Conta">
            <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">GV</span><div><strong>Guilherme Vital</strong><small>Estagiário de Backoffice</small></div></div>
            <button type="button" role="menuitem" className="profile-signout" onClick={() => { setProfileOpen(false); setSignedIn(false); }}>Sair</button>
          </div>}
        </div>
    </header>}
    {signedIn ? <App spotlightOpen={spotlightOpen} onCloseSpotlight={closeSpotlight} /> : <main className="demo-signed-out">
      <div className="demo-signed-out-card">
        <img src="/muv-logo.png" alt="" />
        <h1>Sessão encerrada</h1>
        <p>Prévia de saída de sessão. Nenhum acesso real foi alterado.</p>
        <button type="button" onClick={() => setSignedIn(true)}>Entrar como Guilherme Vital</button>
      </div>
    </main>}
    {signedIn && keyboardHelpOpen && <KeyboardHelp onClose={closeKeyboardHelp} />}
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><DesignLab /></StrictMode>);
