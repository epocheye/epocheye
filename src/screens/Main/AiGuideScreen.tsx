/**
 * AiGuideScreen — site-grounded conversational layer.
 *
 * Redesigned to match Figma "06 AI Guide (Dark)" (240:3): warm-dark canvas,
 * a thumbnail + status top bar, a white assistant bubble with an EPOCHEYE AI
 * label + decorative waveform, a 2-column "TRY ASKING" chip grid, and a white
 * pill input with a single circular accent button that flips between mic
 * (dictate) and send.
 *
 * Behaviour upgrades over the previous version:
 *   - Assistant output renders as Markdown (react-native-markdown-display).
 *   - Voice input is wired (tap mic → dictate → edit → send) via useVoiceInput.
 *   - The "thinking" state and answer bubbles use animated waveforms
 *     (see components/AiThinking). Back always just closes the guide (via
 *     useSafeGoBack) — no leave/stay prompt, and it can never close the app.
 *
 * Streams answers from POST /api/v1/sites/{slug}/guide; welcome narration is
 * rendered locally from content.narratives.by_persona.casual. Conversation
 * history lives in component state; the last 6 turns travel with each request.
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
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Edge-to-edge-aware KAV; the core one was a no-op on Android here, leaving
// the chat input bar underneath the keyboard.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Mic,
  MoreVertical,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
} from 'lucide-react-native';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { getSite } from '../../utils/api/places';
import type { SiteDetail } from '../../utils/api/places';
import { streamGuideAnswer } from '../../utils/api/guide';
import type { GuideHistoryTurn } from '../../utils/api/guide';
import { useVoiceInput } from '../../shared/hooks';
import { useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import { AppAlert } from '../../shared/ui/appAlert';
import MarkdownText from '../../components/ui/MarkdownText';
import { AnimatedWaveform, AiThinkingIndicator } from './components/AiThinking';
import { analytics } from '../../services/analytics';

type Props = MainScreenProps<'AiGuide'>;

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True only for the first assistant bubble (welcome narration). */
  isWelcome?: boolean;
}

const MAX_SUGGESTIONS = 6;
const FLAME = '#CBA862';

const AiGuideScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const { slug, siteName, heroImageUrl } = route.params;

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  // True once the screen has unmounted — used to abort a stream that opens
  // AFTER unmount (unmount landing during the pre-stream token fetch, before
  // `abortRef` is set, would otherwise leak the SSE + setState post-unmount).
  const unmountedRef = useRef(false);
  const listRef = useRef<FlatList<ChatBubble>>(null);

  const voice = useVoiceInput({ onTranscript: setInput });

  // Back always just closes the guide (returns to the site page) — never prompts,
  // never falls through to closing the app. The active stream aborts on unmount.
  const safeGoBack = useSafeGoBack();

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
  useEffect(() => {
    if (messages.length > 0) return;
    const welcome = readWelcomeNarration(siteDetail) ?? defaultWelcome(siteName);
    setMessages([
      { id: 'welcome', role: 'assistant', content: welcome, isWelcome: true },
    ]);
  }, [siteDetail, siteName, messages.length]);

  // Cancel any active stream on unmount.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
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

      analytics.track('ai_guide_question_asked', {slug, chars: question.length});

      if (voice.isListening) {
        void voice.stop();
      }

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

      // Build history from already-finalized exchanges (exclude welcome bubble).
      const history: GuideHistoryTurn[] = messages
        .filter(m => !m.isWelcome)
        .map(m => ({ role: m.role, content: m.content }));

      void streamGuideAnswer(slug, question, history, {
        onChunk: chunk => {
          setStreamingText(prev => prev + chunk);
        },
        onDone: ({ full }) => {
          const finalText = full.length > 0 ? full : '(no response)';
          setMessages(prev => [
            ...prev,
            { id: `a-${Date.now()}`, role: 'assistant', content: finalText },
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
        // If the screen unmounted while the stream was being set up, abort it
        // right away instead of stashing a handle nothing will ever call.
        if (unmountedRef.current) {
          abort();
          return;
        }
        abortRef.current = abort;
      });
    },
    [isStreaming, messages, slug, voice],
  );

  const handleSendPress = useCallback(() => {
    sendQuestion(input);
  }, [sendQuestion, input]);

  // Single circular button: stop dictation → send text → start dictation.
  const handlePrimaryPress = useCallback(() => {
    if (voice.isListening) {
      void voice.stop();
      return;
    }
    if (input.trim().length > 0) {
      handleSendPress();
      return;
    }
    void voice.start();
  }, [voice, input, handleSendPress]);

  const handleSuggestionPress = useCallback(
    (text: string) => {
      sendQuestion(text);
    },
    [sendQuestion],
  );

  const handleClearChat = useCallback(() => {
    AppAlert.confirm({
      title: t('guide.clearConfirmTitle'),
      message: t('guide.clearConfirmMessage'),
      confirmText: t('guide.clearConfirmConfirm'),
      destructive: true,
      onConfirm: () => {
        abortRef.current?.();
        abortRef.current = null;
        setIsStreaming(false);
        setStreamingText('');
        setError(null);
        const welcome =
          readWelcomeNarration(siteDetail) ?? defaultWelcome(siteName);
        setMessages([
          { id: 'welcome', role: 'assistant', content: welcome, isWelcome: true },
        ]);
      },
    });
  }, [siteDetail, siteName, t]);

  const handleRetry = useCallback(() => {
    if (!lastQuestion) return;
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
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, streamingText]);

  const renderItem = useCallback(({ item }: { item: ChatBubble }) => {
    if (item.role === 'assistant') {
      return (
        <View style={styles.assistantWrap}>
          <View style={styles.assistantBubble}>
            <View style={styles.assistantLabelRow}>
              <Sparkles size={11} color={FLAME} />
              <Text style={styles.assistantLabel}>EPOCHEYE AI</Text>
            </View>
            <MarkdownText theme="dark">{item.content}</MarkdownText>
            <View style={styles.bubbleWave}>
              <AnimatedWaveform active variant="calm" bars={8} />
            </View>
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
  }, []);

  const showSuggestions =
    messages.length <= 1 &&
    !isStreaming &&
    !streamingText &&
    faqSuggestions.length > 0;

  const hasText = input.trim().length > 0;
  const statusText = voice.isListening
    ? t('guide.statusListening')
    : t('guide.statusGrounded');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar (Figma 240:16-25) */}
      <View style={styles.topBar}>
        <Pressable
          onPress={safeGoBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('guide.backLabel')}
          style={styles.backButton}>
          <ArrowLeft size={18} color="#F2EBE0" />
        </Pressable>

        {heroImageUrl ? (
          <Image source={{ uri: heroImageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Sparkles size={16} color={FLAME} />
          </View>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {siteName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: voice.isListening ? FLAME : '#3FB950' },
              ]}
            />
            <Text style={styles.status} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleClearChat}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('guide.optionsLabel')}
          style={styles.menuButton}>
          <MoreVertical size={18} color="#A89685" />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <KeyboardAvoidingView behavior="padding" style={styles.flexFill}>
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
            listRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* TRY ASKING chips (Figma 240:40-50) */}
        {showSuggestions ? (
          <View style={styles.suggestionsBlock}>
            <Text style={styles.tryAsking}>{t('guide.tryAsking')}</Text>
            <View style={styles.chipsGrid}>
              {faqSuggestions.map(q => (
                <TouchableOpacity
                  key={q}
                  onPress={() => handleSuggestionPress(q)}
                  activeOpacity={0.78}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={t('guide.askChipLabel', { question: q })}>
                  <Text style={styles.chipText} numberOfLines={2}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Input bar (Figma 240:74-76) */}
        <SafeAreaView edges={['bottom']} style={styles.inputBarOuter}>
          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('guide.inputPlaceholder', {
                name: siteName?.trim() || t('guide.thisPlace'),
              })}
              placeholderTextColor="#898888"
              style={styles.textInput}
              editable={!isStreaming}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendPress}
              accessibilityLabel={t('guide.inputLabel')}
            />
            <Pressable
              onPress={handlePrimaryPress}
              disabled={isStreaming}
              accessibilityRole="button"
              accessibilityLabel={
                voice.isListening
                  ? t('guide.stopDictation')
                  : hasText
                  ? t('guide.sendQuestion')
                  : t('guide.voiceInput')
              }
              style={[
                styles.primaryButton,
                voice.isListening && styles.primaryButtonActive,
                isStreaming && styles.primaryButtonDisabled,
              ]}>
              {voice.isListening ? (
                <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
              ) : hasText ? (
                <Send size={18} color="#0A0A0C" />
              ) : (
                <Mic size={20} color="#0A0A0C" />
              )}
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
}> = ({ streamingText, isStreaming, error, onRetry }) => {
  const { t } = useTranslation();
  if (error) {
    return (
      <View style={styles.errorBubble}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('guide.retry')}>
          <RefreshCcw size={14} color={FLAME} />
          <Text style={styles.retryText}>{t('guide.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (streamingText) {
    return (
      <View style={styles.assistantWrap}>
        <View style={styles.assistantBubble}>
          <MarkdownText theme="dark">{streamingText}</MarkdownText>
        </View>
      </View>
    );
  }

  if (isStreaming) {
    return <AiThinkingIndicator />;
  }

  return null;
};

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
    backgroundColor: '#0A0A0C',
  },
  flexFill: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1F1611',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: 'Fraunces-SemiBold',
    fontSize: 24,
    color: '#F2EBE0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#A89685',
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: 6,
    backgroundColor: '#2D2218',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 14,
  },
  assistantWrap: {
    alignItems: 'flex-start',
    maxWidth: '94%',
  },
  assistantBubble: {
    backgroundColor: '#131218',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  assistantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assistantLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    color: '#CBA862',
    letterSpacing: 0.8,
  },
  bubbleWave: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#1F1611',
    borderWidth: 1,
    borderColor: '#2D2218',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  userText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#F2EBE0',
    lineHeight: 20,
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '94%',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
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
    borderColor: 'rgba(203,168,98,0.4)',
  },
  retryText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: FLAME,
  },
  suggestionsBlock: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  tryAsking: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 14,
    letterSpacing: 1.6,
    color: '#DEDEDE',
    marginBottom: 10,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '47%',
    flexGrow: 1,
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 22,
    backgroundColor: '#1F1611',
    borderWidth: 1,
    borderColor: '#2D2218',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 13,
    color: '#F2EBE0',
    textAlign: 'center',
  },
  inputBarOuter: {
    backgroundColor: '#0A0A0C',
    borderTopWidth: 1,
    borderTopColor: '#2D2218',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#131218',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#F4EFE7',
  },
  primaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FLAME,
  },
  primaryButtonActive: {
    backgroundColor: '#EF4444',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
});

export default AiGuideScreen;
