import { useState } from "react";
import type { KeyboardEvent } from "react";

/** Keeps a long list to one Tab stop while allowing arrow navigation between row actions. */
export function useRovingList(keys: string[], preferredKey?: string) {
  const [focusedKey, setFocusedKey] = useState("");
  const activeKey = keys.includes(focusedKey) ? focusedKey
    : preferredKey && keys.includes(preferredKey) ? preferredKey : keys[0];

  const itemProps = (key: string) => ({
    "data-roving-key": key,
    tabIndex: key === activeKey ? 0 : -1,
    onFocus: () => setFocusedKey(key),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-roving-key]");
    if (!current || !event.currentTarget.contains(current)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-roving-key]")];
    const index = buttons.indexOf(current);
    if (index < 0) return;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : Math.min(buttons.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    event.stopPropagation();
    const next = buttons[nextIndex];
    setFocusedKey(next.dataset.rovingKey ?? "");
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  };

  return { itemProps, onKeyDown };
}
