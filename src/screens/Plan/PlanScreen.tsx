import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  History,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { FONTS } from '../../core/constants/theme';
import { useChatStore } from '../../stores/chatStore';
import type { ChatMessage } from '../../utils/api/chat';
import ThinkingIndicator from './components/ThinkingIndicator';

const SUGGESTIONS = [
  'Plan a 3-day Konark itinerary under ₹5000',
  'Iconography of the Sun Temple wheel',
  'Best heritage sites near Bhubaneswar',
  'Weekend trip: monuments + food in Hampi',
];

const PlanScreen: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    messages,
    loadingMessages,
    sending,
    error,
    loadSessions,
    startNewSession,
    selectSession,
    sendUserMessage,
    removeSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, sending]);

  const handleSend = useCallback(
    async (text?: string) => {
      const payload = (text ?? input).trim();
      if (!payload || sending) return;
      setInput('');
      await sendUserMessage(payload);
    },
    [input, sending, sendUserMessage],
  );

  const handleNewChat = useCallback(async () => {
    await startNewSession();
    setShowHistory(false);
  }, [startNewSession]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {item.content}
        </Text>
      </View>
    );
  }, []);

  const empty = messages.length === 0 && !loadingMessages;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setShowHistory(s => !s)}
          hitSlop={12}
          style={styles.headerButton}
        >
          <History size={20} color="#E8A020" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Sparkles size={16} color="#C9A84C" />
          <Text style={styles.headerTitle}>Plan</Text>
        </View>
        <TouchableOpacity
          onPress={handleNewChat}
          hitSlop={12}
          style={styles.headerButton}
        >
          <Plus size={20} color="#E8A020" />
        </TouchableOpacity>
      </View>

      {showHistory && (
        <View style={styles.historyPanel}>
          {sessions.length === 0 ? (
            <Text style={styles.historyEmpty}>No past conversations yet</Text>
          ) : (
            sessions.slice(0, 8).map(s => (
              <View key={s.id} style={styles.historyRow}>
                <Pressable
                  style={styles.historyItem}
                  onPress={() => {
                    void selectSession(s.id);
                    setShowHistory(false);
                  }}
                >
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                </Pressable>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => void removeSession(s.id)}
                >
                  <Trash2 size={16} color="#6E6A60" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {empty ? (
          <View style={styles.emptyWrap}>
            <Sparkles size={34} color="#C9A84C" />
            <Text style={styles.emptyTitle}>
              Where shall we wander through history?
            </Text>
            <Text style={styles.emptySub}>
              Ask about monuments, build a custom tour, or trace an era.
            </Text>
            <View style={styles.suggestionsWrap}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestion}
                  onPress={() => void handleSend(s)}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            ListFooterComponent={
              sending ? (
                <View style={styles.thinkingWrap}>
                  <ThinkingIndicator />
                </View>
              ) : null
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {error ? <Text style={styles.errorLine}>{error}</Text> : null}

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask or plan…"
            placeholderTextColor="#6E6A60"
            style={styles.textInput}
            multiline
            editable={!sending}
            onSubmitEditing={() => void handleSend()}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={() => void handleSend()}
            disabled={!input.trim() || sending}
            style={[
              styles.sendButton,
              (!input.trim() || sending) && styles.sendButtonDisabled,
            ]}
          >
            <Send size={16} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerButton: { padding: 6 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#F5F0E8',
    fontFamily: FONTS.semiBold,
    fontSize: 17,
  },
  historyPanel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#101010',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyItem: {
    flex: 1,
    paddingVertical: 6,
  },
  historyTitle: {
    color: '#E8DFD1',
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  historyEmpty: {
    color: '#6E6A60',
    fontFamily: FONTS.regular,
    fontSize: 13,
    paddingVertical: 4,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    color: '#F5F0E8',
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  emptySub: {
    color: '#8C8578',
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  suggestionsWrap: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#121212',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,160,32,0.18)',
  },
  suggestionText: {
    color: '#E8DFD1',
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#121212',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#E8A020',
  },
  bubbleText: {
    color: '#E8DFD1',
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#0A0A0A',
    fontFamily: FONTS.medium,
  },
  thinkingWrap: {
    paddingTop: 6,
  },
  errorLine: {
    color: '#FF6B6B',
    fontFamily: FONTS.regular,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0A0A0A',
  },
  textInput: {
    flex: 1,
    color: '#F5F0E8',
    fontFamily: FONTS.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#121212',
    borderRadius: 18,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default PlanScreen;
