import { memo } from "react";

import { AgentNPC } from "./AgentNPC";
import { useAgentBehavior } from "../agent/useAgentBehavior";
import { useVisitorAttention } from '../agent/useVisitorAttention';
import { useGuideSpeech } from '../agent/useGuideSpeech';

export const AgentSystem = memo(function AgentSystem({
  allowMotion = true,
}: {
  allowMotion?: boolean;
}) {
  useAgentBehavior({ allowMotion });
  useVisitorAttention(allowMotion);
  useGuideSpeech();
  return <AgentNPC />;
});
