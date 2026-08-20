import React from "react";
import { renderHook } from "@testing-library/react";
import { AIMessage, Message } from "@copilotkit/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRenderToolCall } from "../../v2";
import { useLazyToolRenderer } from "../use-lazy-tool-renderer";

vi.mock("../../v2", () => ({
  useRenderToolCall: vi.fn(),
}));

const toolCalls = [
  {
    id: "call-first",
    type: "function" as const,
    function: { name: "firstTool", arguments: "{}" },
  },
  {
    id: "call-second",
    type: "function" as const,
    function: { name: "secondTool", arguments: "{}" },
  },
];

const assistantMessage = {
  id: "assistant-message",
  role: "assistant" as const,
  content: "",
  toolCalls,
} satisfies AIMessage;

describe("useLazyToolRenderer", () => {
  const renderToolCall = vi.fn(
    ({ toolCall }: { toolCall: (typeof toolCalls)[number] }) => (
      <div>{toolCall.function.name}</div>
    ),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRenderToolCall).mockReturnValue(renderToolCall as any);
  });

  it("creates one lazy renderer per tool call in message order", () => {
    const messages = [
      assistantMessage,
      {
        id: "result-second",
        role: "tool" as const,
        toolCallId: "call-second",
        content: "second result",
      },
      {
        id: "interleaved-user",
        role: "user" as const,
        content: "keep going",
      },
      {
        id: "result-first",
        role: "tool" as const,
        toolCallId: "call-first",
        content: "first result",
      },
    ] satisfies Message[];
    const { result } = renderHook(() => useLazyToolRenderer());

    const lazyRenderers = result.current(assistantMessage, messages);

    expect(lazyRenderers).toHaveLength(2);
    lazyRenderers.forEach((render) => render());
    expect(renderToolCall).toHaveBeenNthCalledWith(1, {
      toolCall: toolCalls[0],
      toolMessage: messages[3],
    });
    expect(renderToolCall).toHaveBeenNthCalledWith(2, {
      toolCall: toolCalls[1],
      toolMessage: messages[1],
    });
  });

  it("keeps calls without matching results renderable", () => {
    const matchingResult = {
      id: "result-second",
      role: "tool" as const,
      toolCallId: "call-second",
      content: "second result",
    };
    const { result } = renderHook(() => useLazyToolRenderer());

    const lazyRenderers = result.current(assistantMessage, [matchingResult]);

    lazyRenderers.forEach((render) => render());
    expect(renderToolCall).toHaveBeenNthCalledWith(1, {
      toolCall: toolCalls[0],
      toolMessage: undefined,
    });
    expect(renderToolCall).toHaveBeenNthCalledWith(2, {
      toolCall: toolCalls[1],
      toolMessage: matchingResult,
    });
  });

  it("returns no lazy renderers for messages without tool calls", () => {
    const { result } = renderHook(() => useLazyToolRenderer());

    expect(
      result.current({
        id: "plain-assistant",
        role: "assistant",
        content: "No tools needed",
      }),
    ).toEqual([]);
    expect(renderToolCall).not.toHaveBeenCalled();
  });
});
