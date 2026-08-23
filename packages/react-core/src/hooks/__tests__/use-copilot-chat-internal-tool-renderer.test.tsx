import { render, renderHook, screen } from "@testing-library/react";
import type { Message } from "@copilotkit/shared";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotContext } from "../../context";
import { createTestCopilotContext } from "../../test-helpers/copilot-context";
import { CoAgentStateRenderBridge } from "../use-coagent-state-render-bridge";
import { useCopilotChatInternal } from "../use-copilot-chat_internal";

const mocks = vi.hoisted(() => ({
  lazyToolRenderer: vi.fn(),
  renderCustomMessage: vi.fn(() => null),
}));

const mockAgent = {
  messages: [] as Message[],
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
      runtimeConnectionStatus: undefined,
      getAgent: vi.fn(() => mockAgent),
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
  useRenderCustomMessages: vi.fn(() => mocks.renderCustomMessage),
  useSuggestions: vi.fn(() => ({ suggestions: [], isLoading: false })),
}));

vi.mock("../../components/toast/toast-provider", () => ({
  useToast: () => ({ setBannerError: vi.fn(), addToast: vi.fn() }),
}));

vi.mock("../../components/error-boundary/error-utils", () => ({
  useAsyncCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock("../use-lazy-tool-renderer", () => ({
  useLazyToolRenderer: vi.fn(() => mocks.lazyToolRenderer),
}));

function createWrapper() {
  const context = createTestCopilotContext();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <CopilotContext.Provider value={context}>
        {children}
      </CopilotContext.Provider>
    );
  };
}

function assistantMessage(): Message {
  return {
    id: "assistant-1",
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: "tool-call-1",
        type: "function",
        function: { name: "firstTool", arguments: "{}" },
      },
      {
        id: "tool-call-2",
        type: "function",
        function: { name: "secondTool", arguments: "{}" },
      },
    ],
  };
}

describe("useCopilotChatInternal tool renderers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.messages = [assistantMessage()];
    mockAgent.state = {};
    mockAgent.isRunning = false;
  });

  it("composes every non-null tool renderer in order", () => {
    mocks.lazyToolRenderer.mockReturnValue([
      () => <span>first tool</span>,
      () => null,
      () => <span>second tool</span>,
    ]);
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });
    const generativeUI = result.current.messages[0].generativeUI;

    render(<>{generativeUI?.()}</>);

    expect(screen.getAllByText(/tool$/).map((node) => node.textContent)).toEqual(
      ["first tool", "second tool"],
    );
    expect(mocks.renderCustomMessage).not.toHaveBeenCalled();
  });

  it("continues to the bridge renderer when all tool renderers return null", () => {
    mocks.lazyToolRenderer.mockReturnValue([() => null, () => null]);
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });

    const rendered = result.current.messages[0].generativeUI?.();

    expect(React.isValidElement(rendered)).toBe(true);
    expect((rendered as React.ReactElement).type).toBe(CoAgentStateRenderBridge);
  });

  it("keeps the bridge renderer available when there are no tool calls", () => {
    mocks.lazyToolRenderer.mockReturnValue(null);
    mockAgent.messages = [
      { id: "assistant-1", role: "assistant", content: "" },
    ];
    const { result } = renderHook(() => useCopilotChatInternal(), {
      wrapper: createWrapper(),
    });

    const rendered = result.current.messages[0].generativeUI?.();

    expect(React.isValidElement(rendered)).toBe(true);
    expect((rendered as React.ReactElement).type).toBe(CoAgentStateRenderBridge);
  });
});
