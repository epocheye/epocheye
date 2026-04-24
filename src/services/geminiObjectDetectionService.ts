/**
 * Gemini multi-object detection.
 *
 * Used by the dev-only "scan any object" flow. Sends a camera-captured
 * image (base64) to Gemini 2.5 Flash and asks for every distinct object
 * with a bounding box, so the user can tap one to reconstruct.
 *
 * Returns boxes in Gemini's native 0-1000 normalised scale (ymin, xmin,
 * ymax, xmax). The consumer is responsible for mapping to pixel coords.
 */

import axios from 'axios';
import { GEMINI_API_KEY } from '@env';

export interface DetectedObject {
  name: string;
  description: string;
  box_2d: [number, number, number, number];
}

interface DetectSuccess {
  success: true;
  data: DetectedObject[];
}
interface DetectFailure {
  success: false;
  error: string;
}
export type DetectResult = DetectSuccess | DetectFailure;

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TIMEOUT_MS = 15_000;

const PROMPT = [
  'Detect every distinct, clearly-visible object in this image.',
  'Return ONLY a JSON array (no markdown, no code fences, no prose before or after).',
  'Each item: {"name": string, "description": string, "box_2d": [ymin, xmin, ymax, xmax]}.',
  '- name: concise object name, 1-3 words (e.g. "ceramic vase", "wooden chair").',
  '- description: one short phrase describing it.',
  '- box_2d: tight bounding box in 0-1000 normalised coordinates.',
  'Return at most 8 items, prefer salient and non-overlapping objects.',
].join('\n');

function extractArray(text: string): DetectedObject[] | null {
  const tryParse = (s: string): DetectedObject[] | null => {
    try {
      const parsed = JSON.parse(s);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(
        (item): item is DetectedObject =>
          item &&
          typeof item.name === 'string' &&
          typeof item.description === 'string' &&
          Array.isArray(item.box_2d) &&
          item.box_2d.length === 4 &&
          item.box_2d.every((n: unknown) => typeof n === 'number'),
      );
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) return direct;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const fenced = tryParse(fence[1].trim());
    if (fenced) return fenced;
  }

  const bracket = text.match(/\[[\s\S]*\]/);
  if (bracket) {
    const arr = tryParse(bracket[0]);
    if (arr) return arr;
  }

  return null;
}

export async function detectObjects(imageBase64: string): Promise<DetectResult> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      },
      { timeout: TIMEOUT_MS },
    );

    const text: string =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      return { success: false, error: 'Empty response from Gemini' };
    }

    const parsed = extractArray(text);
    if (!parsed) {
      return { success: false, error: 'Could not parse detection response' };
    }

    return { success: true, data: parsed };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        return { success: false, error: 'Detection timed out — hold steady and retry' };
      }
      const status = err.response?.status;
      if (status === 429) {
        return { success: false, error: 'Rate limit reached — try again shortly' };
      }
      return { success: false, error: `Detection API error (${status ?? 'network'})` };
    }
    return { success: false, error: 'Detection failed — try again' };
  }
}
