import { create } from 'zustand';
import {
  createSession,
  deleteSession as deleteSessionApi,
  listMessages,
  listSessions,
  sendMessage,
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
  error: string | null;

  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<ChatSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  sendUserMessage: (content: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  clear: () => void;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  loadingSessions: false,
  loadingMessages: false,
  sending: false,
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
    }));
    return newSession;
  },

  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId, loadingMessages: true, messages: [] });
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

    // Ensure a session exists before sending.
    let activeId = get().activeSessionId;
    if (!activeId) {
      const created = await get().startNewSession();
      if (!created) return;
      activeId = created.id;
    }

    // Optimistically append the user message so the input clears immediately.
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      session_id: activeId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    set(state => ({
      messages: [...state.messages, optimisticUser],
      sending: true,
      error: null,
    }));

    const result = await sendMessage(activeId, trimmed);
    if (!result.success) {
      // Roll back the optimistic message and surface the error.
      set(state => ({
        messages: state.messages.filter(m => m.id !== optimisticUser.id),
        sending: false,
        error: result.error.message,
      }));
      return;
    }

    const { user_message, assistant_message } = result.data;
    set(state => ({
      messages: [
        ...state.messages.filter(m => m.id !== optimisticUser.id),
        user_message,
        assistant_message,
      ],
      sending: false,
    }));

    // Refresh the session list so the newly-titled session bubbles to the top.
    void get().loadSessions();
  },

  removeSession: async (sessionId: string) => {
    const prev = get().sessions;
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== sessionId),
      activeSessionId:
        state.activeSessionId === sessionId ? null : state.activeSessionId,
      messages: state.activeSessionId === sessionId ? [] : state.messages,
    }));
    const result = await deleteSessionApi(sessionId);
    if (!result.success) {
      set({ sessions: prev, error: result.error.message });
    }
  },

  clear: () => {
    set({
      sessions: [],
      activeSessionId: null,
      messages: [],
      loadingSessions: false,
      loadingMessages: false,
      sending: false,
      error: null,
    });
  },
}));
