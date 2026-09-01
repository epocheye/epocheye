/**
 * The player must not report an ending that belongs to the previous clip.
 *
 * MEASURED ON DEVICE, in this order, with the audio guide walking itself:
 *
 *   LOAD palace_overview dur=55.56 | END palace_overview |
 *   END into_the_shade | LOAD into_the_shade dur=51.816 | LOAD the_pillars
 *
 * The third event is the previous clip's ending arriving late and wearing the
 * new clip's name — the new source had not even loaded yet. ExoPlayer is still
 * parked in STATE_ENDED from the clip that just finished, and preparing the
 * next one emits a second ended event.
 *
 * Any caller that advances on `onEnd` therefore skipped a stop for every stop
 * it played: the eight-stop palace guide walked itself end to end in about a
 * minute. This is what stops that at the source, so no caller has to know.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

/** The <Video> element, replaced by a handle on its callbacks. */
let video: Record<string, any> | null = null;
jest.mock('react-native-video', () => {
  const React_ = require('react');
  const Mock = (props: any) => {
    video = props;
    return React_.createElement('Video', props);
  };
  return {__esModule: true, default: Mock};
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (k: string) => k, i18n: {language: 'en'}}),
}));

import AudioPlayer from '../../src/components/AudioPlayer';

const A = 'https://cdn.test/a.mp3';
const B = 'https://cdn.test/b.mp3';

const load = async (seconds = 50) => {
  await ReactTestRenderer.act(async () => {
    video?.onLoad?.({duration: seconds, currentTime: 0, naturalSize: {}} as any);
  });
};
const end = async () => {
  await ReactTestRenderer.act(async () => {
    video?.onEnd?.();
  });
};

beforeEach(() => {
  video = null;
});

describe('AudioPlayer — one ending per source', () => {
  it('reports the ending of a clip that actually loaded', async () => {
    const onEnd = jest.fn();
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AudioPlayer uri={A} sourceKey="a" autoPlay onEnd={onEnd} />,
      );
    });
    await load();
    await end();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('SWALLOWS the previous clip ending again after the source swaps', async () => {
    const onEnd = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <AudioPlayer uri={A} sourceKey="a" autoPlay onEnd={onEnd} />,
      );
    });
    await load();
    await end();
    expect(onEnd).toHaveBeenCalledTimes(1);

    // The caller advances. The new source has NOT loaded yet.
    await ReactTestRenderer.act(async () => {
      tree.update(<AudioPlayer uri={B} sourceKey="b" autoPlay onEnd={onEnd} />);
    });
    await end();

    // Still one. Without the guard this is the skipped stop.
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Once the new clip has loaded and genuinely finished, it is reported.
    await load(40);
    await end();
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('does not report the same clip ending twice', async () => {
    const onEnd = jest.fn();
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <AudioPlayer uri={A} sourceKey="a" autoPlay onEnd={onEnd} />,
      );
    });
    await load();
    await end();
    await end();
    await end();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('still reports an ending for two stops that share one audio file', async () => {
    // Same URL, different stop: the media never reloads, so onLoad never fires
    // again. The guard must not mistake that for "this source never loaded".
    const onEnd = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <AudioPlayer uri={A} sourceKey="a" autoPlay onEnd={onEnd} />,
      );
    });
    await load();
    await end();
    expect(onEnd).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      tree.update(<AudioPlayer uri={A} sourceKey="a2" autoPlay onEnd={onEnd} />);
    });
    await end();
    expect(onEnd).toHaveBeenCalledTimes(2);
  });
});
