import React from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { AIMessage } from "@copilotkit/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoAgentStateRendersProvider, CopilotContext } from "../../context";
import { createTestCopilotContext } from "../../test-helpers/copilot-context";
import { useLazyToolRenderer } from "../use-lazy-tool-renderer";
import { useCopilotChatInternal } from "../use-copilot-chat_internal";

const assistantMessage = {
  id: "assistant-message",
  role: "assistant" as const,
  content: "",
  toolCalls: [
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
  ],
} satisfies AIMessage;

const mockAgent = {
  messages: [assistantMessage],
  state: {},
  isRunning: false,
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  setMessages: vi.fn(),
  setState: vi.fn(),
  addMessage: vi.fn(),
  abortRun: vi.fn(),
  runAgent: vi.fn(),
  detachActiveRun: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../v2", () => ({
  useAgent: vi.fn(() => ({ agent: mockAgent })),
  useCopilotKit: vi.fn(() => ({
    copilotkit: {
      connectAgent: vi.fn(),
      getRunIdForMessage: vi.fn(),
      runAgent: vi.fn(),
      clearSuggestions: vi.fn(),
      addSuggestionsConfig: vi.fn(),
      reloadSuggestions: vi.fn(),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      interruptElement: null,
    },
  })),
  useCopilotChatConfiguration: vi.fn(() => ({ agentId: "test-agent" })),
  useRenderCustomMessages: vi.fn(() => undefined),
  useSuggestions: vi.fn(() => ({ suggestions: [], isLoading: false })),
}));

vi.mock("../../components/toast/toast-provider", () => ({
  useToast: () => ({ setBannerError: vi.fn(), addToast: vi.fn() }),
}));

vi.mock("../../components/error-boundary/error-utils", () => ({
  useAsyncCallback: <T extends (...args: any[]) => unknown>(fn: T) => fn,
}));

vi.mock("../use-langgraph-interrupt-render", () => ({
  useLangGraphInterruptRender: vi.fn(() => null),
}));

vi.mock("../use-lazy-tool-renderer", () => ({
  useLazyToolRenderer: vi.fn(),
}));

function createWrapper() {
  const copilotContextValue = createTestCopilotContext();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <CopilotContext.Provider value={copilotContextValue}>
        <CoAgentStateRendersProvider>{children}</CoAgentStateRendersProvider>
      </CopilotContext.Provider>
    );
  };
}

describe("useCopilotChatInternal tool rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.messages = [assistantMessage];
  });

  it("combines every rendered tool call in order on one assistant message", () => {
    vi.mocked(useLazyToolRenderer).mockReturnValue(() => [
      () => <div data-testid="tool-call">first</div>,
      () => <div data-testid="tool-call">second</div>,
    ]);
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });
    const message = result.current.messages[0] as AIMessage;

    render(<>{message.generativeUI?.()}</>);

    expect(
      screen.getAllByTestId("tool-call").map((node) => node.textContent),
    ).toEqual(["first", "second"]);
  });

  it("does not let a null renderer suppress a later tool call", () => {
    vi.mocked(useLazyToolRenderer).mockReturnValue(() => [
      () => null,
      () => <div data-testid="tool-call">second</div>,
    ]);
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });
    const message = result.current.messages[0] as AIMessage;

    render(<>{message.generativeUI?.()}</>);

    expect(screen.getByTestId("tool-call").textContent).toBe("second");
  });

  it("uses the existing custom-message fallback when every renderer is null", () => {
    vi.mocked(useLazyToolRenderer).mockReturnValue(() => [
      () => null,
      () => null,
    ]);
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });
    const message = result.current.messages[0] as AIMessage;

    expect(message.generativeUIPosition).toBe("before");
    expect(message.generativeUI).toBeTypeOf("function");
  });
});
