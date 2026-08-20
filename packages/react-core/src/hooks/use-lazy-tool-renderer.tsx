import { useRenderToolCall } from "../v2";
import { AIMessage, Message, ToolResult } from "@copilotkit/shared";
import React, { useCallback } from "react";

export function useLazyToolRenderer(): (
  message?: AIMessage,
  messages?: Message[],
) => Array<() => ReturnType<ReturnType<typeof useRenderToolCall>> | null> {
  const renderToolCall = useRenderToolCall();

  return useCallback(
    (message?: AIMessage, messages?: Message[]) => {
      if (!message?.toolCalls?.length) return [];

      return message.toolCalls.map((toolCall) => {
        const toolMessage = messages?.find(
          (m) => m.role === "tool" && m.toolCallId === toolCall.id,
        ) as ToolResult | undefined;

        return () =>
          renderToolCall({
            toolCall,
            toolMessage,
          });
      });
    },
    [renderToolCall],
  );
}
