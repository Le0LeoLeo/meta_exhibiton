import { ReactNode } from "react";
import "./editor.css";

type Props = {
  children: ReactNode;
  hasInspector?: boolean;
};

export function EditorShell({ children, hasInspector = false }: Props) {
  return <div className="editor-shell pointer-events-none absolute inset-0" data-inspector-open={hasInspector}>{children}</div>;
}
