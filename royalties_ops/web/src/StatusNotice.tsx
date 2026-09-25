import type { ReactNode } from "react";

type Props = { tone: "loading" | "success" | "error"; children: ReactNode; className?: string };

export default function StatusNotice({ tone, children, className = "" }: Props) {
  return <div className={`status-notice is-${tone}${className ? ` ${className}` : ""}`} role={tone === "error" ? "alert" : "status"}>
    <span className="status-notice-mark" aria-hidden="true" />
    <span>{children}</span>
  </div>;
}
