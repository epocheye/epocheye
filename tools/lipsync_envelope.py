"""
Turn a narration track into a viseme track.

WHY THIS EXISTS. The Tipu asset is rigged by Meshy with no facial bones at all - the
skeleton stops at Head/headfront - so the mouth can only be moved by glTF morph targets.
tipu_figure_royal5.glb now carries seven, authored as shape keys in Blender:

    AA  jaw open, lips relaxed          O    rounded, protruded
    E   spread wide, slightly closed    U    pursed hard, protruded
    I   spread, nearly closed           MBP  pressed shut
                                        FV   lower lip drawn back and up

WHAT DRIVES THEM, AND WHAT DOES NOT. There is no forced aligner installed, so the
transcript cannot be timed against the audio and the phoneme sequence is NOT known. What
IS knowable from the signal alone, per 40 ms window, is:

    loudness            -> how far the jaw drops           (RMS, not peak)
    spectral centroid   -> how far FORWARD the tongue is   (a crude F2 proxy)
    zero-crossing rate  -> voiced vowel vs unvoiced fricative

Front vowels (as in "see", "bet") push energy high in the spectrum; back and rounded
vowels ("boot", "go") pull it low. That is a real acoustic property of the vowel space,
not a guess, and it is enough to choose BETWEEN mouth shapes even without knowing which
phoneme was spoken. Fricatives (/f/, /s/, /v/) are noisy and high-crossing with little
energy, which is a distinct enough signature to trigger FV.

So: the jaw timing is exact, because it comes from the audio's own envelope. The mouth
SHAPE is estimated, and will sometimes be the wrong vowel. Stated plainly rather than
sold as lip reading - at conversational AR distance the eye reads "the shape keeps
changing in time with the voice", which is what makes a talking figure convincing.

Loudness is RMS and not peak on purpose: peak follows plosives and clicks and makes the
jaw snap; RMS follows the energy of the voice and moves like a jaw does.

Output is plain JSON - times in seconds, a 0..1 openness, and a per-window viseme index
plus weight - so nothing at runtime has to decode or analyse audio.

    python tools/lipsync_envelope.py <audio> [audio...]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16000          # speech energy lives well below 8 kHz; more is wasted work
WINDOW_S = 0.040             # 40 ms - a jaw cannot move meaningfully faster than 25 Hz
SMOOTH_WINDOW = 3            # gentle 3-window mean; enough to stop chatter, keeps attack
NOISE_FLOOR_PCTL = 20        # below this percentile is silence/room tone, not speech
GAIN_PCTL = 95               # map this percentile to fully open, so one shout cannot
                             # compress every normal syllable into a mumble

VISEME_NAMES = ["AA", "E", "I", "O", "U", "MBP", "FV"]
REST = -1

# The centroid splits the vowel space by tongue position: back/rounded low, open middle,
# front high. The split points are PERCENTILES of the track's own voiced windows, not
# absolute hertz, for the same reason the RMS floor is: a first pass with fixed thresholds
# (950 / 1650 Hz) put this narrator's median at 824 Hz and so classified 58% of the track
# as rounded and 1.6% as spread, which is not what English sounds like. The narration was
# not mismeasured - the voice is simply low and the mp3 rolls off the top - so the
# thresholds have to follow the track.
#
# 30/70 is a stylistic choice, not a linguistic measurement, and is stated as such: with
# no phoneme identity available, what is being bought is a mouth that varies plausibly
# rather than locking into one extreme.
CENTROID_BACK_PCTL = 30
CENTROID_FRONT_PCTL = 70
# A fricative is noise: many zero crossings, little energy behind them.
ZCR_FRICATIVE = 0.22
FRICATIVE_MAX_OPEN = 0.45
# Below this openness the mouth is closed, not merely quiet.
CLOSED_OPEN = 0.12


def decode(path: Path) -> np.ndarray:
    """Decode any audio ffmpeg understands to mono float32."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path),
         "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32)


def _frames(samples: np.ndarray):
    win = int(SAMPLE_RATE * WINDOW_S)
    n = len(samples) // win
    if n == 0:
        return None, 0
    return samples[: n * win].reshape(n, win).astype(np.float64), win


def envelope(samples: np.ndarray):
    """Per-window jaw openness, 0..1, from RMS normalised to the track's own statistics."""
    frames, _ = _frames(samples)
    if frames is None:
        return [], []
    rms = np.sqrt(np.mean(frames ** 2, axis=1))

    # Normalise against the track's own statistics rather than absolute levels: these
    # mp3s were mastered independently, so a fixed threshold would suit one and not others.
    floor = np.percentile(rms, NOISE_FLOOR_PCTL)
    ceil = np.percentile(rms, GAIN_PCTL)
    if ceil <= floor:
        ceil = floor + 1e-6
    open_amt = np.clip((rms - floor) / (ceil - floor), 0.0, 1.0)

    if SMOOTH_WINDOW > 1:
        k = np.ones(SMOOTH_WINDOW) / SMOOTH_WINDOW
        open_amt = np.convolve(open_amt, k, mode="same")

    times = (np.arange(len(open_amt)) * WINDOW_S).tolist()
    return times, open_amt.tolist()


def spectral(samples: np.ndarray):
    """Per-window spectral centroid (Hz, over the speech band) and zero-crossing rate."""
    frames, win = _frames(samples)
    if frames is None:
        return np.array([]), np.array([])

    window = np.hanning(win)
    mag = np.abs(np.fft.rfft(frames * window, axis=1))
    freqs = np.fft.rfftfreq(win, 1.0 / SAMPLE_RATE)
    band = (freqs >= 100.0) & (freqs <= 5000.0)
    m = mag[:, band]
    f = freqs[band]
    energy = m.sum(axis=1)
    centroid = np.where(energy > 1e-9, (m * f).sum(axis=1) / np.maximum(energy, 1e-9), 0.0)

    signs = np.signbit(frames)
    zcr = np.mean(signs[:, 1:] != signs[:, :-1], axis=1)
    return centroid, zcr


def visemes(open_amt, centroid, zcr):
    """
    Choose one viseme per window from (openness, centroid, crossing rate).

    Only ONE target is emitted per window; the runtime blends between consecutive
    windows, so a held vowel crossfades rather than stepping. Emitting a blend here
    would just be smoothing applied twice.
    """
    # Calibrate the front/back split on the VOICED windows only - including the silences
    # would drag both thresholds down toward room tone, which has no vowel colour at all.
    voiced = np.array([c for o, c in zip(open_amt, centroid) if o >= CLOSED_OPEN])
    if voiced.size == 0:
        voiced = np.array(centroid)
    back_hz = float(np.percentile(voiced, CENTROID_BACK_PCTL))
    front_hz = float(np.percentile(voiced, CENTROID_FRONT_PCTL))

    idx, wt = [], []
    for o, c, z in zip(open_amt, centroid, zcr):
        if o < CLOSED_OPEN:
            # Genuinely quiet. A closed mouth reads better than a slack one, and MBP is
            # also what a real speaker's mouth does between words.
            idx.append(VISEME_NAMES.index("MBP"))
            wt.append(round(float(0.35 * (1.0 - o / CLOSED_OPEN)), 4))
            continue
        if z > ZCR_FRICATIVE and o < FRICATIVE_MAX_OPEN:
            idx.append(VISEME_NAMES.index("FV"))
            wt.append(round(float(min(1.0, o / FRICATIVE_MAX_OPEN)), 4))
            continue
        if c < back_hz:
            # Back / rounded. Louder rounds harder toward O; quiet purses toward U.
            name = "O" if o > 0.45 else "U"
        elif c > front_hz:
            # Front / spread. Louder spreads wider (E); quiet stays nearly closed (I).
            name = "E" if o > 0.40 else "I"
        else:
            name = "AA"
        idx.append(VISEME_NAMES.index(name))
        wt.append(round(float(o), 4))
    return idx, wt, round(back_hz), round(front_hz)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: lipsync_envelope.py <audio> [audio...]")
        return 2
    for raw in sys.argv[1:]:
        src = Path(raw)
        samples = decode(src)
        times, opens = envelope(samples)
        if not times:
            print(f"{src.name}: EMPTY - no audio decoded")
            continue
        centroid, zcr = spectral(samples)
        vi, vw, back_hz, front_hz = visemes(opens, centroid, zcr)

        dst = src.with_suffix(".lipsync.json")
        dst.write_text(json.dumps({
            "source": src.name,
            "windowSeconds": WINDOW_S,
            "durationSeconds": round(times[-1] + WINDOW_S, 3),
            "times": [round(t, 3) for t in times],
            "open": [round(v, 4) for v in opens],
            "visemeNames": VISEME_NAMES,
            "viseme": vi,
            "visemeWeight": vw,
        }))
        speaking = sum(1 for v in opens if v > 0.15) / len(opens)
        hist = {n: vi.count(i) for i, n in enumerate(VISEME_NAMES) if vi.count(i)}
        print(f"{src.name}: {len(times)} frames, {times[-1] + WINDOW_S:.1f}s, "
              f"{speaking * 100:.0f}% voiced -> {dst.name}\n"
              f"    centroid {centroid.min():.0f}-{centroid.max():.0f} Hz "
              f"(median {np.median(centroid):.0f}), split at {back_hz}/{front_hz} Hz\n"
              f"    visemes {hist}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
