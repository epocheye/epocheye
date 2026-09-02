/**
 * The figure's voice has three behaviours that break silently.
 *
 * 1. TAPPING THE SAME LINE AGAIN MUST REPLAY IT. The line index has not
 *    changed, and neither has the URL, so nothing a naive implementation
 *    watches has changed either — and the visitor taps a man who says nothing.
 * 2. THE DUCK MUST BE LIFTED. `onSpeakingChange` is what suspends the guide
 *    narration underneath a line. If it never reports false, the guide stays
 *    paused for the rest of the visit and no error is raised anywhere.
 * 3. A FAILED LOAD IS NOT A HANG. An error has to end the utterance for the
 *    same reason: silence is recoverable, a permanently ducked guide is not.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

/** The <Video> element, replaced by a handle on its props. */
let video: Record<string, any> | null = null;
let seeks = 0;
jest.mock('react-native-video', () => {
  const React_ = require('react');
  const Mock = React_.forwardRef((props: any, ref: any) => {
    video = props;
    React_.useImperativeHandle(ref, () => ({
      seek: () => {
        seeks += 1;
      },
    }));
    return React_.createElement('Video', props);
  });
  return {__esModule: true, default: Mock};
});

import FigureVoice from '../../src/features/magicwindow/FigureVoice';

const A = 'https://cdn.test/line_1_en.mp3';
const B = 'https://cdn.test/line_2_en.mp3';

const render = (el: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(el);
  });
  return tree;
};

beforeEach(() => {
  video = null;
  seeks = 0;
});

describe('FigureVoice', () => {
  it('starts a line and reports that he is speaking', () => {
    const onSpeakingChange = jest.fn();
    render(
      <FigureVoice uri={A} lineKey="p-0-1" onSpeakingChange={onSpeakingChange} />,
    );
    expect(video?.paused).toBe(false);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true);
  });

  it('replays the SAME line when the utterance changes', () => {
    const onSpeakingChange = jest.fn();
    const tree = render(
      <FigureVoice uri={A} lineKey="p-0-1" onSpeakingChange={onSpeakingChange} />,
    );
    ReactTestRenderer.act(() => {
      video?.onEnd?.();
    });
    expect(video?.paused).toBe(true);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);

    // Same uri, same line, new utterance: he must speak again.
    ReactTestRenderer.act(() => {
      tree.update(
        <FigureVoice
          uri={A}
          lineKey="p-0-2"
          onSpeakingChange={onSpeakingChange}
        />,
      );
    });
    expect(video?.paused).toBe(false);
    expect(seeks).toBeGreaterThan(0);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true);
  });

  it('does not restart when only the callback identity changes', () => {
    const tree = render(<FigureVoice uri={A} lineKey="p-0-1" />);
    ReactTestRenderer.act(() => {
      video?.onEnd?.();
    });
    expect(video?.paused).toBe(true);
    ReactTestRenderer.act(() => {
      tree.update(
        <FigureVoice uri={A} lineKey="p-0-1" onSpeakingChange={() => {}} />,
      );
    });
    // Still parked. A re-render is not a tap.
    expect(video?.paused).toBe(true);
  });

  it('moves to the next line', () => {
    const tree = render(<FigureVoice uri={A} lineKey="p-0-1" />);
    ReactTestRenderer.act(() => {
      tree.update(<FigureVoice uri={B} lineKey="p-1-2" />);
    });
    expect(video?.source?.uri).toBe(B);
    expect(video?.paused).toBe(false);
  });

  it('lifts the duck when the line is muted mid-sentence', () => {
    const onSpeakingChange = jest.fn();
    const tree = render(
      <FigureVoice uri={A} lineKey="p-0-1" onSpeakingChange={onSpeakingChange} />,
    );
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true);
    ReactTestRenderer.act(() => {
      tree.update(
        <FigureVoice uri={null} lineKey={null} onSpeakingChange={onSpeakingChange} />,
      );
    });
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
    expect(tree.toJSON()).toBeNull();
  });

  it('treats a load failure as the end of the utterance', () => {
    const onSpeakingChange = jest.fn();
    render(
      <FigureVoice uri={A} lineKey="p-0-1" onSpeakingChange={onSpeakingChange} />,
    );
    ReactTestRenderer.act(() => {
      video?.onError?.({error: {errorString: 'nope'}});
    });
    expect(video?.paused).toBe(true);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
  });

  it('plays whatever pair it is handed — which is why the caller must keep them atomic', () => {
    // THIS IS THE CONTRACT, not a wish. FigureVoice cannot know that a key
    // belongs to a different file than the one it was given, so a caller that
    // advances the key while the URL is still resolving gets the PREVIOUS line
    // replayed. That happened: MagicWindowScreen held the two in separate state
    // and the device logged `player piid:8815 started 15:53:18.000, stopped
    // 15:53:18.182` — 182 ms of line 1 in front of every line 2.
    //
    // The screen now stores {uri, key} as one object so the pair cannot skew.
    // If anyone is ever tempted to paper over it in here instead, this test says
    // what the component is actually promising.
    const tree = render(<FigureVoice uri={A} lineKey="p-0-1" />);
    ReactTestRenderer.act(() => {
      video?.onEnd?.();
    });
    const before = seeks;
    ReactTestRenderer.act(() => {
      tree.update(<FigureVoice uri={A} lineKey="p-1-2" />);
    });
    expect(video?.source?.uri).toBe(A);
    expect(video?.paused).toBe(false);
    expect(seeks).toBeGreaterThan(before);
  });

  it('renders nothing at all when the figure has no clip', () => {
    const tree = render(<FigureVoice uri={null} lineKey={null} />);
    expect(tree.toJSON()).toBeNull();
  });
});
