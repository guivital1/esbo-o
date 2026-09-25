import type { KeyboardEvent } from "react";

/** Arrow keys change the active view in a compact tab or filter group. */
export function onTabArrowKey(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const current = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!current || current.parentElement !== event.currentTarget) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)")];
  const index = buttons.indexOf(current);
  if (index < 0) return;
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault();
  buttons[nextIndex].focus();
  buttons[nextIndex].click();
}
