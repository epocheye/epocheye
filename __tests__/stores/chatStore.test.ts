/**
 * Tests for the chat Zustand store — session management, optimistic send,
 * rollback on failure, and session deletion.
 */

const mockListSessions = jest.fn();
const mockCreateSession = jest.fn();
const mockListMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockDeleteSession = jest.fn();

jest.mock('../../src/utils/api/chat', () => ({
  listSessions: (...args: unknown[]) => mockListSessions(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  listMessages: (...args: unknown[]) => mockListMessages(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
}));

import { useChatStore } from '../../src/stores/chatStore';

beforeEach(() => {
  useChatStore.getState().clear();
  mockListSessions.mockReset();
  mockCreateSession.mockReset();
  mockListMessages.mockReset();
  mockSendMessage.mockReset();
  mockDeleteSession.mockReset();
});

describe('loadSessions', () => {
  it('populates sessions on success', async () => {
    const sessions = [{ id: 's1', title: 'Trip plan', created_at: '' }];
    mockListSessions.mockResolvedValueOnce({ success: true, data: sessions });

    await useChatStore.getState().loadSessions();
    expect(useChatStore.getState().sessions).toEqual(sessions);
    expect(useChatStore.getState().loadingSessions).toBe(false);
  });

  it('sets error on failure', async () => {
    mockListSessions.mockResolvedValueOnce({
      success: false,
      error: { message: 'net', statusCode: 0 },
    });

    await useChatStore.getState().loadSessions();
    expect(useChatStore.getState().error).toBe('net');
    expect(useChatStore.getState().loadingSessions).toBe(false);
  });
});

describe('startNewSession', () => {
  it('prepends the new session and sets it active', async () => {
    const newSession = { id: 's2', title: '', created_at: '' };
    mockCreateSession.mockResolvedValueOnce({ success: true, data: newSession });

    const result = await useChatStore.getState().startNewSession();
    expect(result).toEqual(newSession);
    expect(useChatStore.getState().activeSessionId).toBe('s2');
    expect(useChatStore.getState().sessions[0].id).toBe('s2');
  });

  it('returns null and sets error on failure', async () => {
    mockCreateSession.mockResolvedValueOnce({
      success: false,
      error: { message: 'fail', statusCode: 500 },
    });

    const result = await useChatStore.getState().startNewSession();
    expect(result).toBeNull();
    expect(useChatStore.getState().error).toBe('fail');
  });
});

describe('selectSession', () => {
  it('sets activeSessionId and loads messages', async () => {
    const msgs = [
      { id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: '' },
    ];
    mockListMessages.mockResolvedValueOnce({ success: true, data: msgs });

    await useChatStore.getState().selectSession('s1');
    expect(useChatStore.getState().activeSessionId).toBe('s1');
    expect(useChatStore.getState().messages).toEqual(msgs);
    expect(useChatStore.getState().loadingMessages).toBe(false);
  });
});

describe('sendUserMessage', () => {
  it('optimistically adds user message then replaces with server response', async () => {
    // Pre-set an active session
    mockCreateSession.mockResolvedValueOnce({
      success: true,
      data: { id: 's1', title: '', created_at: '' },
    });
    await useChatStore.getState().startNewSession();

    const serverUser = { id: 'mu', session_id: 's1', role: 'user', content: 'hi', created_at: '' };
    const serverAssistant = {
      id: 'ma',
      session_id: 's1',
      role: 'assistant',
      content: 'hello',
      created_at: '',
    };
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      data: { user_message: serverUser, assistant_message: serverAssistant },
    });
    // loadSessions is called after send — stub it out
    mockListSessions.mockResolvedValueOnce({ success: true, data: [] });

    await useChatStore.getState().sendUserMessage('hi');

    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe('mu');
    expect(msgs[1].id).toBe('ma');
    expect(useChatStore.getState().sending).toBe(false);
  });

  it('rolls back optimistic message on failure', async () => {
    mockCreateSession.mockResolvedValueOnce({
      success: true,
      data: { id: 's1', title: '', created_at: '' },
    });
    await useChatStore.getState().startNewSession();

    mockSendMessage.mockResolvedValueOnce({
      success: false,
      error: { message: 'send failed', statusCode: 500 },
    });

    await useChatStore.getState().sendUserMessage('hi');

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(useChatStore.getState().error).toBe('send failed');
    expect(useChatStore.getState().sending).toBe(false);
  });

  it('skips empty/whitespace messages', async () => {
    await useChatStore.getState().sendUserMessage('   ');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('creates a session if none is active before sending', async () => {
    const newSession = { id: 'auto', title: '', created_at: '' };
    mockCreateSession.mockResolvedValueOnce({ success: true, data: newSession });
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      data: {
        user_message: { id: 'u1', session_id: 'auto', role: 'user', content: 'yo', created_at: '' },
        assistant_message: { id: 'a1', session_id: 'auto', role: 'assistant', content: 'hey', created_at: '' },
      },
    });
    mockListSessions.mockResolvedValueOnce({ success: true, data: [] });

    await useChatStore.getState().sendUserMessage('yo');

    expect(mockCreateSession).toHaveBeenCalled();
    expect(useChatStore.getState().activeSessionId).toBe('auto');
  });
});

describe('removeSession', () => {
  it('optimistically removes and restores on failure', async () => {
    // Seed a session
    const sessions = [{ id: 's1', title: 'X', created_at: '' }];
    mockListSessions.mockResolvedValueOnce({ success: true, data: sessions });
    await useChatStore.getState().loadSessions();

    // Set active
    useChatStore.setState({ activeSessionId: 's1' });

    mockDeleteSession.mockResolvedValueOnce({
      success: false,
      error: { message: 'forbidden', statusCode: 403 },
    });

    await useChatStore.getState().removeSession('s1');

    // Sessions restored because delete failed
    expect(useChatStore.getState().sessions).toEqual(sessions);
    expect(useChatStore.getState().error).toBe('forbidden');
  });

  it('clears messages and activeSessionId when active session is removed', async () => {
    const sessions = [{ id: 's1', title: '', created_at: '' }];
    mockListSessions.mockResolvedValueOnce({ success: true, data: sessions });
    await useChatStore.getState().loadSessions();
    useChatStore.setState({ activeSessionId: 's1', messages: [{ id: 'm1' }] as any });

    mockDeleteSession.mockResolvedValueOnce({ success: true, data: {} });
    await useChatStore.getState().removeSession('s1');

    expect(useChatStore.getState().activeSessionId).toBeNull();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});

describe('clear', () => {
  it('resets all state', () => {
    useChatStore.setState({
      sessions: [{ id: 's1' }] as any,
      activeSessionId: 's1',
      messages: [{ id: 'm1' }] as any,
      error: 'old',
    });

    useChatStore.getState().clear();
    const s = useChatStore.getState();
    expect(s.sessions).toHaveLength(0);
    expect(s.activeSessionId).toBeNull();
    expect(s.messages).toHaveLength(0);
    expect(s.error).toBeNull();
  });
});
