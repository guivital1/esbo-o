import { useEffect, useRef } from "react";

type Props = { onClose: () => void };

export default function KeyboardHelp({ onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className="keyboard-help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="keyboard-help" role="dialog" aria-modal="true" aria-labelledby="keyboard-help-title">
      <header><div><span>ACESSIBILIDADE</span><h2 id="keyboard-help-title">Navegação por teclado</h2></div><button ref={closeButton} type="button" aria-label="Fechar ajuda de teclado" onClick={onClose}>×</button></header>
      <dl>
        <div><dt>Ir para um controle</dt><dd><kbd>Tab</kbd> <kbd>Shift</kbd> + <kbd>Tab</kbd></dd></div>
        <div><dt>Buscar página, fonte ou arquivo</dt><dd><kbd>⌘</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>K</kbd></dd></div>
        <div><dt>Percorrer linhas de listas e tabelas</dt><dd><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd></dd></div>
        <div><dt>Alternar abas e filtros</dt><dd><kbd>←</kbd> <kbd>→</kbd></dd></div>
        <div><dt>Abrir ou confirmar</dt><dd><kbd>Enter</kbd> / <kbd>Espaço</kbd></dd></div>
        <div><dt>Fechar painel ou diálogo</dt><dd><kbd>Esc</kbd></dd></div>
      </dl>
      <p>As setas percorrem itens quando o foco está na lista. Em campos de texto e seletores, conservam a função normal de edição.</p>
    </section>
  </div>;
}
