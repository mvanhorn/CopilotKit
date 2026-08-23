import { renderHook } from "@testing-library/react";
import type { AIMessage, Message } from "@copilotkit/shared";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRenderToolCall } from "../../v2";
import { useLazyToolRenderer } from "../use-lazy-tool-renderer";

vi.mock("../../v2", () => ({
  useRenderToolCall: vi.fn(),
}));

const firstToolCall = {
  id: "tool-call-1",
  type: "function" as const,
  function: { name: "firstTool", arguments: "{}" },
};

const secondToolCall = {
  id: "tool-call-2",
  type: "function" as const,
  function: { name: "secondTool", arguments: "{}" },
};

describe("useLazyToolRenderer", () => {
  const renderToolCall = vi.fn(
    ({ toolCall }: { toolCall: { id: string } }) => (
      <div>{toolCall.id}</div>
    ),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRenderToolCall).mockReturnValue(renderToolCall as never);
  });

  it("creates a renderer for every tool call in message order", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      content: "",
      toolCalls: [firstToolCall, secondToolCall],
    } satisfies AIMessage;
    const messages = [
      message,
      {
        id: "tool-result-2",
        role: "tool",
        toolCallId: secondToolCall.id,
        content: "second result",
      },
      {
        id: "tool-result-1",
        role: "tool",
        toolCallId: firstToolCall.id,
        content: "first result",
      },
    ] satisfies Message[];
    const { result } = renderHook(() => useLazyToolRenderer());

    const renderers = result.current(message, messages);

    expect(renderers).toHaveLength(2);
    renderers?.forEach((renderer) => renderer());
    expect(renderToolCall).toHaveBeenNthCalledWith(1, {
      toolCall: firstToolCall,
      toolMessage: messages[2],
    });
    expect(renderToolCall).toHaveBeenNthCalledWith(2, {
      toolCall: secondToolCall,
      toolMessage: messages[1],
    });
  });

  it("renders an unmatched tool call without suppressing matched siblings", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      content: "",
      toolCalls: [firstToolCall, secondToolCall],
    } satisfies AIMessage;
    const toolMessage = {
      id: "tool-result-2",
      role: "tool",
      toolCallId: secondToolCall.id,
      content: "second result",
    } satisfies Message;
    const { result } = renderHook(() => useLazyToolRenderer());

    result.current(message, [message, toolMessage])?.forEach((renderer) =>
      renderer(),
    );

    expect(renderToolCall).toHaveBeenNthCalledWith(1, {
      toolCall: firstToolCall,
      toolMessage: undefined,
    });
    expect(renderToolCall).toHaveBeenNthCalledWith(2, {
      toolCall: secondToolCall,
      toolMessage,
    });
  });

  it("keeps single-call and no-tool-call behavior", () => {
    const message = {
      id: "assistant-1",
      role: "assistant",
      content: "",
      toolCalls: [firstToolCall],
    } satisfies AIMessage;
    const { result } = renderHook(() => useLazyToolRenderer());

    expect(result.current(message, [message])).toHaveLength(1);
    expect(
      result.current({ ...message, toolCalls: undefined }, [message]),
    ).toBeNull();
  });
});
