import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function EditorShell({ children }: Props) {
  return <div className="pointer-events-none absolute inset-0">{children}</div>;
}
