import { create } from 'zustand';
import {
  createSession,
  deleteSession as deleteSessionApi,
  listMessages,
  listSessions,
  streamMessage,
  type ChatMessage,
  type ChatSession,
} from '../utils/api/chat';

interface ChatStoreState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  loadingSessions: boolean;
  loadingMessages: boolean;
  sending: boolean;
  streaming: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<ChatSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  sendUserMessage: (content: string) => Promise<void>;
  abortStream: () => void;
  removeSession: (sessionId: string) => Promise<void>;
  clear: () => void;
}

// Module-local abort ref keeps the current SSE handle out of the React tree.
let activeAbort: (() => void) | null = null;

const runAbort = () => {
  if (activeAbort) {
    try {
      activeAbort();
    } catch {
      /* ignore */
    }
    activeAbort = null;
  }
};

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  loadingSessions: false,
  loadingMessages: false,
  sending: false,
  streaming: false,
  error: null,

  loadSessions: async () => {
    set({ loadingSessions: true, error: null });
    const result = await listSessions();
    if (result.success) {
      set({ sessions: result.data, loadingSessions: false });
    } else {
      set({ loadingSessions: false, error: result.error.message });
    }
  },

  startNewSession: async () => {
    runAbort();
    const result = await createSession();
    if (!result.success) {
      set({ error: result.error.message });
      return null;
    }
    const newSession = result.data;
    set(state => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: newSession.id,
      messages: [],
      error: null,
      sending: false,
      streaming: false,
    }));
    return newSession;
  },

  selectSession: async (sessionId: string) => {
    runAbort();
    set({
      activeSessionId: sessionId,
      loadingMessages: true,
      messages: [],
      sending: false,
      streaming: false,
    });
    const result = await listMessages(sessionId);
    if (result.success) {
      set({ messages: result.data, loadingMessages: false });
    } else {
      set({ loadingMessages: false, error: result.error.message });
    }
  },

  sendUserMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (get().sending) return;

    let activeId = get().activeSessionId;
    if (!activeId) {
      const created = await get().startNewSession();
      if (!created) return;
      activeId = created.id;
    }

    const optimisticUserId = `optimistic-user-${Date.now()}`;
    const streamingAssistantId = `streaming-assistant-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticUser: ChatMessage = {
      id: optimisticUserId,
      session_id: activeId,
      role: 'user',
      content: trimmed,
      created_at: nowIso,
    };

    set(state => ({
      messages: [...state.messages, optimisticUser],
      sending: true,
      streaming: false,
      error: null,
    }));

    runAbort();

    activeAbort = await streamMessage(activeId, trimmed, {
      onUserMessage: canonicalUser => {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === optimisticUserId ? canonicalUser : m,
          ),
        }));
      },
      onChunk: text => {
        set(state => {
          const existing = state.messages.find(
            m => m.id === streamingAssistantId,
          );
          if (existing) {
            return {
              ...state,
              streaming: true,
              messages: state.messages.map(m =>
                m.id === streamingAssistantId
                  ? { ...m, content: m.content + text }
                  : m,
              ),
            };
          }
          const placeholder: ChatMessage = {
            id: streamingAssistantId,
            session_id: activeId!,
            role: 'assistant',
            content: text,
            created_at: new Date().toISOString(),
          };
          return {
            ...state,
            streaming: true,
            messages: [...state.messages, placeholder],
          };
        });
      },
      onDone: ({ assistantMessage }) => {
        activeAbort = null;
        set(state => {
          const hasPlaceholder = state.messages.some(
            m => m.id === streamingAssistantId,
          );
          const nextMessages = hasPlaceholder
            ? state.messages.map(m =>
                m.id === streamingAssistantId ? assistantMessage : m,
              )
            : [...state.messages, assistantMessage];
          return {
            ...state,
            messages: nextMessages,
            sending: false,
            streaming: false,
          };
        });
        void get().loadSessions();
      },
      onError: message => {
        activeAbort = null;
        set(state => ({
          messages: state.messages.filter(
            m => m.id !== optimisticUserId && m.id !== streamingAssistantId,
          ),
          sending: false,
          streaming: false,
          error: message,
        }));
      },
    });
  },

  abortStream: () => {
    runAbort();
    set(state => {
      if (!state.sending && !state.streaming) {
        return state;
      }
      return {
        ...state,
        messages: state.messages.filter(
          m =>
            !m.id.startsWith('optimistic-user-') &&
            !m.id.startsWith('streaming-assistant-'),
        ),
        sending: false,
        streaming: false,
      };
    });
  },

  removeSession: async (sessionId: string) => {
    const prev = get().sessions;
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== sessionId),
      activeSessionId:
        state.activeSessionId === sessionId ? null : state.activeSessionId,
      messages: state.activeSessionId === sessionId ? [] : state.messages,
    }));
    if (get().activeSessionId === null) {
      runAbort();
    }
    const result = await deleteSessionApi(sessionId);
    if (!result.success) {
      set({ sessions: prev, error: result.error.message });
    }
  },

  clear: () => {
    runAbort();
    set({
      sessions: [],
      activeSessionId: null,
      messages: [],
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      streaming: false,
      error: null,
    });
  },
}));
