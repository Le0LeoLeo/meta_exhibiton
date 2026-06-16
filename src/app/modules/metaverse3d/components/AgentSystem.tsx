import { memo } from "react";

import { AgentNPC } from "./AgentNPC";
import { useAgentBehavior } from "../agent/useAgentBehavior";

export const AgentSystem = memo(function AgentSystem({
  allowMotion = true,
}: {
  allowMotion?: boolean;
}) {
  useAgentBehavior({ allowMotion });
  return <AgentNPC />;
});
