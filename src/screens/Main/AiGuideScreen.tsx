/**
 * AiGuideScreen — site-grounded conversational layer.
 *
 * Streams answers from POST /api/v1/sites/{slug}/guide with the typewriter
 * effect coming for free from chunk arrival. Welcome narration is rendered
 * locally from siteDetail.content.narratives.by_persona.casual — no LLM
 * call for the first bubble.
 *
 * Conversation history lives in component state (no Zustand, no persistence)
 * and the last 6 turns travel with each request so follow-ups stay coherent.
 *
 * TODO (later prompts):
 *   - voice input wiring (mic icon is a placeholder for now)
 *   - hook this screen up from the AR experience screen
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
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
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, Mic, RefreshCcw, Send, Sparkles} from 'lucide-react-native';
import type {MainScreenProps} from '../../core/types/navigation.types';
import {getSite} from '../../utils/api/places';
import type {SiteDetail} from '../../utils/api/places';
import {streamGuideAnswer} from '../../utils/api/guide';
import type {GuideHistoryTurn} from '../../utils/api/guide';

type Props = MainScreenProps<'AiGuide'>;

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True only for the first assistant bubble (welcome narration). */
  isWelcome?: boolean;
}

const MAX_SUGGESTIONS = 4;
const AMBER = '#E8A020';

const AiGuideScreen: React.FC<Props> = ({navigation, route}) => {
  const {slug, siteName, heroImageUrl} = route.params;

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  const listRef = useRef<FlatList<ChatBubble>>(null);

  // Fetch the full site content (we need narratives + faq from content.*).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getSite(slug);
      if (cancelled) return;
      if (result.success) {
        setSiteDetail(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Seed the welcome bubble from content.narratives.by_persona.casual.
  // Falls back to a generic line until content loads.
  useEffect(() => {
    if (messages.length > 0) return;
    const welcome = readWelcomeNarration(siteDetail) ?? defaultWelcome(siteName);
    setMessages([
      {id: 'welcome', role: 'assistant', content: welcome, isWelcome: true},
    ]);
  }, [siteDetail, siteName, messages.length]);

  // Cancel any active stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  const faqSuggestions = useMemo<string[]>(() => {
    const faq = readFaq(siteDetail);
    return faq.slice(0, MAX_SUGGESTIONS);
  }, [siteDetail]);

  const sendQuestion = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || isStreaming) return;

      setError(null);
      setLastQuestion(question);
      setInput('');
      setIsStreaming(true);
      setStreamingText('');

      const userBubble: ChatBubble = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: question,
      };
      setMessages(prev => [...prev, userBubble]);

      // Build history from already-finalized exchanges (exclude the welcome bubble).
      const history: GuideHistoryTurn[] = messages
        .filter(m => !m.isWelcome)
        .map(m => ({role: m.role, content: m.content}));

      void streamGuideAnswer(slug, question, history, {
        onChunk: chunk => {
          setStreamingText(prev => prev + chunk);
        },
        onDone: ({full}) => {
          const finalText =
            full.length > 0 ? full : '(no response)';
          setMessages(prev => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: finalText,
            },
          ]);
          setStreamingText('');
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: msg => {
          setError(msg);
          setStreamingText('');
          setIsStreaming(false);
          abortRef.current = null;
        },
      }).then(abort => {
        abortRef.current = abort;
      });
    },
    [isStreaming, messages, slug],
  );

  const handleSendPress = useCallback(() => {
    sendQuestion(input);
  }, [sendQuestion, input]);

  const handleSuggestionPress = useCallback(
    (text: string) => {
      sendQuestion(text);
    },
    [sendQuestion],
  );

  const handleRetry = useCallback(() => {
    if (!lastQuestion) return;
    // Drop the user bubble of the failed attempt before retrying so we don't
    // duplicate it.
    setMessages(prev => {
      const lastUserIdx = [...prev]
        .reverse()
        .findIndex(m => m.role === 'user' && m.content === lastQuestion);
      if (lastUserIdx === -1) return prev;
      const idx = prev.length - 1 - lastUserIdx;
      return prev.slice(0, idx);
    });
    sendQuestion(lastQuestion);
  }, [lastQuestion, sendQuestion]);

  // Auto-scroll to the latest content as new chunks arrive.
  useEffect(() => {
    if (messages.length === 0 && !streamingText) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({animated: true});
    });
  }, [messages, streamingText]);

  const renderItem = useCallback(
    ({item}: {item: ChatBubble}) => {
      const isAssistant = item.role === 'assistant';
      if (isAssistant) {
        return (
          <View style={styles.assistantWrap}>
            {item.isWelcome ? (
              <View style={styles.assistantLabelRow}>
                <Sparkles size={12} color={AMBER} />
                <Text style={styles.assistantLabel}>EPOCHEYE AI</Text>
              </View>
            ) : null}
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantText}>{item.content}</Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.userWrap}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        </View>
      );
    },
    [],
  );

  const showSuggestions =
    messages.length <= 1 &&
    !isStreaming &&
    !streamingText &&
    faqSuggestions.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.iconButton}>
          <ArrowLeft size={18} color="#FFFFFF" />
        </Pressable>

        {heroImageUrl ? (
          <Image source={{uri: heroImageUrl}} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Sparkles size={14} color={AMBER} />
          </View>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {siteName}
          </Text>
          <Text style={styles.status} numberOfLines={1}>
            AI guide · grounded in site data
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexFill}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <FooterArea
              streamingText={streamingText}
              isStreaming={isStreaming}
              error={error}
              onRetry={handleRetry}
            />
          }
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({animated: true})
          }
        />

        {/* Suggestion chips */}
        {showSuggestions ? (
          <View style={styles.chipsRow}>
            {faqSuggestions.map(q => (
              <TouchableOpacity
                key={q}
                onPress={() => handleSuggestionPress(q)}
                activeOpacity={0.75}
                style={styles.chip}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${q}`}>
                <Text style={styles.chipText} numberOfLines={2}>
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Input bar */}
        <SafeAreaView edges={['bottom']} style={styles.inputBarOuter}>
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about Konark…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.textInput}
              editable={!isStreaming}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendPress}
              accessibilityLabel="Question input"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voice input (coming soon)"
              disabled
              style={[styles.inputIconButton, styles.inputIconDisabled]}>
              <Mic size={18} color="rgba(255,255,255,0.4)" />
            </Pressable>
            <Pressable
              onPress={handleSendPress}
              disabled={!input.trim() || isStreaming}
              accessibilityRole="button"
              accessibilityLabel="Send question"
              style={[
                styles.sendButton,
                (!input.trim() || isStreaming) && styles.sendButtonDisabled,
              ]}>
              <Send size={16} color="#1A0F00" />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const FooterArea: React.FC<{
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  onRetry: () => void;
}> = ({streamingText, isStreaming, error, onRetry}) => {
  if (error) {
    return (
      <View style={styles.errorBubble}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry">
          <RefreshCcw size={14} color={AMBER} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (streamingText) {
    return (
      <View style={styles.assistantWrap}>
        <View style={styles.assistantBubble}>
          <Text style={styles.assistantText}>{streamingText}</Text>
        </View>
      </View>
    );
  }

  if (isStreaming) {
    return (
      <View style={styles.assistantWrap}>
        <View style={[styles.assistantBubble, styles.thinkingBubble]}>
          <ThinkingDots />
        </View>
      </View>
    );
  }

  return null;
};

const ThinkingDots: React.FC = () => (
  <View style={styles.thinkingRow}>
    <View style={[styles.dot, styles.dot1]} />
    <View style={[styles.dot, styles.dot2]} />
    <View style={[styles.dot, styles.dot3]} />
  </View>
);

// --- content helpers ---

function readWelcomeNarration(detail: SiteDetail | null): string | null {
  const narratives = detail?.content?.narratives;
  if (!isObject(narratives)) return null;
  const byPersona = (narratives as Record<string, unknown>).by_persona;
  if (!isObject(byPersona)) return null;
  const casual = (byPersona as Record<string, unknown>).casual;
  if (typeof casual === 'string' && casual.trim().length > 0) return casual;
  return null;
}

function readFaq(detail: SiteDetail | null): string[] {
  const faq = detail?.content?.faq;
  if (!Array.isArray(faq)) return [];
  const out: string[] = [];
  for (const entry of faq) {
    if (!isObject(entry)) continue;
    const q = (entry as Record<string, unknown>).q;
    if (typeof q === 'string' && q.trim().length > 0) {
      out.push(q.trim());
    }
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function defaultWelcome(siteName: string): string {
  return `Welcome. Ask me anything about ${siteName} — the history, the carvings, the engineering, the legends. I answer only from verified site data.`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020202',
  },
  flexFill: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#141414',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  status: {
    marginTop: 2,
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  assistantWrap: {
    alignItems: 'flex-start',
    maxWidth: '92%',
  },
  assistantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    marginLeft: 4,
  },
  assistantLabel: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 10,
    color: AMBER,
    letterSpacing: 1.4,
  },
  assistantBubble: {
    backgroundColor: 'rgba(232,160,32,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.25)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantText: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
  },
  userText: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 20,
  },
  thinkingBubble: {
    paddingVertical: 14,
  },
  thinkingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMBER,
    opacity: 0.6,
  },
  dot1: {opacity: 0.9},
  dot2: {opacity: 0.6},
  dot3: {opacity: 0.35},
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '92%',
  },
  errorText: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.4)',
  },
  retryText: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 12,
    color: AMBER,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.35)',
    maxWidth: '100%',
  },
  chipText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 12,
    color: '#FFE4B5',
  },
  inputBarOuter: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 14,
    color: '#FFFFFF',
  },
  inputIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputIconDisabled: {
    opacity: 0.6,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AMBER,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(232,160,32,0.35)',
  },
});

export default AiGuideScreen;
