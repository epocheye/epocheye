import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
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
    messages,
    loadingMessages,
    sending,
    streaming,
    error,
    loadSessions,
    startNewSession,
    selectSession,
    sendUserMessage,
    abortStream,
    removeSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    return () => {
      abortStream();
    };
  }, [abortStream]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, sending, streaming]);

  const showThinking = sending && !streaming;

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
        className={`max-w-[88%] px-[14px] py-[10px] rounded-2xl ${
          isUser
            ? 'self-end bg-accent-amber'
            : 'self-start bg-[#121212]'
        }`}
        style={isUser ? undefined : {borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)'}}>
        <Text
          className={`font-montserrat text-[14px] leading-5 ${
            isUser ? 'text-surface-1 font-montserrat-medium' : 'text-[#E8DFD1]'
          }`}>
          {item.content}
        </Text>
      </View>
    );
  }, []);

  const empty = messages.length === 0 && !loadingMessages;

  return (
    <SafeAreaView className="flex-1 bg-surface-1" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View
        className="flex-row items-center px-4 pt-[6px] pb-[10px]"
        style={{borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)'}}>
        <TouchableOpacity
          onPress={() => setShowHistory(s => !s)}
          hitSlop={12}
          className="p-[6px]">
          <History size={20} color="#E8A020" />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center justify-center gap-x-[6px]">
          <Sparkles size={16} color="#C9A84C" />
          <Text className="text-parchment font-montserrat-semibold text-[17px]">Plan</Text>
        </View>
        <TouchableOpacity
          onPress={handleNewChat}
          hitSlop={12}
          className="p-[6px]">
          <Plus size={20} color="#E8A020" />
        </TouchableOpacity>
      </View>

      {showHistory && (
        <View
          className="px-4 py-[10px] gap-y-2 bg-[#101010]"
          style={{borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)'}}>
          {sessions.length === 0 ? (
            <Text className="text-[#6E6A60] font-montserrat text-[13px] py-1">
              No past conversations yet
            </Text>
          ) : (
            sessions.slice(0, 8).map(s => (
              <View key={s.id} className="flex-row items-center gap-x-[10px]">
                <Pressable
                  className="flex-1 py-[6px]"
                  onPress={() => {
                    void selectSession(s.id);
                    setShowHistory(false);
                  }}>
                  <Text className="text-[#E8DFD1] font-montserrat-medium text-[13px]" numberOfLines={1}>
                    {s.title}
                  </Text>
                </Pressable>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => void removeSession(s.id)}>
                  <Trash2 size={16} color="#6E6A60" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {empty ? (
          <View className="flex-1 items-center justify-center px-7 gap-y-[10px]">
            <Sparkles size={34} color="#C9A84C" />
            <Text className="text-parchment font-montserrat-semibold text-[18px] text-center mt-[6px]">
              Where shall we wander through history?
            </Text>
            <Text className="text-[#8C8578] font-montserrat text-[14px] text-center mb-3">
              Ask about monuments, build a custom tour, or trace an era.
            </Text>
            <View className="w-full gap-y-2 mt-1">
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  className="px-[14px] py-3 bg-[#121212] rounded-[14px]"
                  style={{borderWidth: 0.5, borderColor: 'rgba(232,160,32,0.18)'}}
                  onPress={() => void handleSend(s)}>
                  <Text className="text-[#E8DFD1] font-montserrat text-[13px]">{s}</Text>
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
            contentContainerStyle={{paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 10}}
            ListFooterComponent={
              showThinking ? (
                <View className="pt-[6px]">
                  <ThinkingIndicator />
                </View>
              ) : null
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {error ? (
          <Text className="text-[#FF6B6B] font-montserrat text-[13px] px-4 pb-1">
            {error}
          </Text>
        ) : null}

        <View
          className="flex-row items-end gap-x-[10px] px-4 pt-2 pb-3 bg-surface-1"
          style={{borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)'}}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask or plan…"
            placeholderTextColor="#6E6A60"
            className="flex-1 text-parchment font-montserrat text-[14px] px-[14px] pt-[10px] pb-[10px] bg-[#121212] rounded-[18px] max-h-[120px]"
            multiline
            editable={!sending}
            onSubmitEditing={() => void handleSend()}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={() => void handleSend()}
            disabled={!input.trim() || sending}
            className={`w-10 h-10 rounded-full bg-accent-amber items-center justify-center${
              (!input.trim() || sending) ? ' opacity-50' : ''
            }`}>
            <Send size={16} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PlanScreen;
