/**
 * MarkdownText — themed Markdown renderer for AI Guide answers.
 *
 * The guide backend can return Markdown (bold, lists, headings, links, code).
 * This wraps `react-native-markdown-display` with two palettes:
 *   - "light": black/ink text for the white assistant bubble (Figma 240:3)
 *   - "dark":  cream text for use directly on the warm-dark background
 *
 * Fonts come from the bundled Instrument family so it matches the rest of the
 * heritage UI rather than the platform default.
 */

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';

type Theme = 'light' | 'dark';

interface Props {
  children: string;
  theme?: Theme;
}

const FONT_BODY = 'InstrumentSans-Regular';
const FONT_BOLD = 'InstrumentSans-SemiBold';
const FONT_SERIF = 'InstrumentSerif-Regular';
const FONT_MONO = 'InstrumentSans-Regular';

function buildStyles(theme: Theme) {
  const isLight = theme === 'light';
  const text = isLight ? '#1F1611' : '#F2EBE0';
  const muted = isLight ? '#6B5D4F' : 'rgba(242,235,224,0.7)';
  const accent = '#B8551A';
  const codeBg = isLight ? 'rgba(31,22,17,0.06)' : 'rgba(255,255,255,0.08)';
  const rule = isLight ? 'rgba(31,22,17,0.12)' : 'rgba(255,255,255,0.12)';

  return {
    body: {
      fontFamily: FONT_BODY,
      fontSize: 14,
      lineHeight: 22,
      color: text,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
    },
    heading1: { fontFamily: FONT_SERIF, fontSize: 22, lineHeight: 28, color: text, marginBottom: 6 },
    heading2: { fontFamily: FONT_SERIF, fontSize: 19, lineHeight: 25, color: text, marginBottom: 6 },
    heading3: { fontFamily: FONT_BOLD, fontSize: 16, lineHeight: 22, color: text, marginBottom: 4 },
    strong: { fontFamily: FONT_BOLD, color: text },
    em: { fontStyle: 'italic' as const, color: text },
    link: { color: accent, textDecorationLine: 'underline' as const },
    blockquote: {
      backgroundColor: codeBg,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 10,
    },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { flexDirection: 'row' as const, marginBottom: 4 },
    bullet_list_icon: { color: accent, marginRight: 6, lineHeight: 22 },
    ordered_list_icon: { color: accent, marginRight: 6, lineHeight: 22 },
    code_inline: {
      fontFamily: FONT_MONO,
      backgroundColor: codeBg,
      color: text,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    code_block: {
      fontFamily: FONT_MONO,
      backgroundColor: codeBg,
      color: text,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    fence: {
      fontFamily: FONT_MONO,
      backgroundColor: codeBg,
      color: text,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    hr: { backgroundColor: rule, height: 1, marginVertical: 10 },
    textgroup: { color: muted },
  };
}

const MarkdownText: React.FC<Props> = ({ children, theme = 'light' }) => {
  const styles = useMemo(() => buildStyles(theme), [theme]);
  return <Markdown style={styles}>{children}</Markdown>;
};

export default MarkdownText;
