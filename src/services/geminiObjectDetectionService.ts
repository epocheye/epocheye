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
  'Detect the main distinct, clearly-visible objects in this image.',
  'Return ONLY a JSON array (no markdown, no code fences, no prose).',
  'Each item: {"name": string, "description": string, "box_2d": [ymin, xmin, ymax, xmax]}.',
  '- name: 1-3 words (e.g. "spray bottle", "wooden chair").',
  '- description: ONE short phrase, max 8 words.',
  '- box_2d: tight bbox in 0-1000 normalised coords.',
  'Return at most 5 items. Prefer salient, foreground, non-overlapping objects.',
  'Skip walls, floors, ceilings, and large background surfaces.',
].join('\n');

function validateArray(parsed: unknown): DetectedObject[] | null {
  if (!Array.isArray(parsed)) return null;
  const items = parsed.filter(
    (item): item is DetectedObject =>
      item &&
      typeof item.name === 'string' &&
      typeof item.description === 'string' &&
      Array.isArray(item.box_2d) &&
      item.box_2d.length === 4 &&
      item.box_2d.every((n: unknown) => typeof n === 'number'),
  );
  return items.length > 0 ? items : null;
}

function findArrayInValue(value: unknown): DetectedObject[] | null {
  const direct = validateArray(value);
  if (direct) return direct;
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findArrayInValue(v);
      if (found) return found;
    }
  }
  return null;
}

function tryParseAndExtract(s: string): DetectedObject[] | null {
  try {
    return findArrayInValue(JSON.parse(s));
  } catch {
    return null;
  }
}

function extractArray(text: string): DetectedObject[] | null {
  const direct = tryParseAndExtract(text);
  if (direct) return direct;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const fenced = tryParseAndExtract(fence[1].trim());
    if (fenced) return fenced;
  }

  // Greedy + non-greedy bracket attempts.
  const bracketGreedy = text.match(/\[[\s\S]*\]/);
  if (bracketGreedy) {
    const arr = tryParseAndExtract(bracketGreedy[0]);
    if (arr) return arr;
  }

  // Last resort: object wrapping that wasn't valid JSON at the top-level.
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const obj = tryParseAndExtract(objectMatch[0]);
    if (obj) return obj;
  }

  // Salvage truncated arrays: response was cut mid-object by maxOutputTokens.
  // Strategy: find the last `},` that sits inside the outer array, take
  // everything up to and including the `}`, and close the array with `]`.
  const arrayStart = text.indexOf('[');
  if (arrayStart >= 0) {
    const lastObjectClose = text.lastIndexOf('},');
    if (lastObjectClose > arrayStart) {
      const salvaged = text.slice(arrayStart, lastObjectClose + 1) + ']';
      const arr = tryParseAndExtract(salvaged);
      if (arr) {
        if (__DEV__) {
          console.warn(
            '[detectObjects] response was truncated — salvaged',
            arr.length,
            'objects',
          );
        }
        return arr;
      }
    }
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
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      },
      { timeout: TIMEOUT_MS },
    );

    const text: string =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (__DEV__) {
      console.log('[detectObjects] textLen=' + text.length);
      console.log('[detectObjects] preview:', text.slice(0, 400));
    }
    if (!text) {
      return { success: false, error: 'Empty response from Gemini' };
    }

    const parsed = extractArray(text);
    if (!parsed) {
      if (__DEV__) {
        console.warn('[detectObjects] parse failed — full text:', text);
      }
      return { success: false, error: 'Could not parse detection response' };
    }

    if (__DEV__) {
      console.log('[detectObjects] parsed', parsed.length, 'objects');
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
