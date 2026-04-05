import {GEMINI_API_KEY} from '@env';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;
const GEMINI_BASE_MODELS_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT_MS = 30000;
const HEALTH_CHECK_PROMPT = 'Respond with exactly: OK';
const HEALTH_CHECK_SYSTEM_INSTRUCTION = 'Return only OK.';

interface GeminiTextRequestOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GeminiStreamTextOptions extends GeminiTextRequestOptions {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: () => void;
  timeout?: number;
}

export type GeminiHealthCheckResult =
  | {
      ok: true;
      status: 'success';
      detail: string;
    }
  | {
      ok: false;
      status: 'missing-key' | 'request-failed';
      detail: string;
    };

type GeminiResponseShape = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
};

let hasReportedMissingKey = false;
let hasLoggedGeminiConfigState = false;

function logGeminiDebug(message: string): void {
  if (__DEV__) {
    console.log(`[Gemini] ${message}`);
  }
}

function logGeminiRequestIssue(message: string): void {
  if (__DEV__) {
    console.warn(`[Gemini] ${message}`);
  }
}

function getGeminiApiKey(): string | null {
  const parsed =
    typeof GEMINI_API_KEY === 'string' ? GEMINI_API_KEY.trim() : '';
  const hasKey = parsed.length > 0;

  if (__DEV__ && !hasLoggedGeminiConfigState) {
    hasLoggedGeminiConfigState = true;
    if (hasKey) {
      logGeminiDebug('GEMINI_API_KEY detected (non-empty).');
    } else {
      logGeminiRequestIssue('GEMINI_API_KEY is empty or undefined.');
    }
  }

  return hasKey ? parsed : null;
}

function reportMissingGeminiKey(): void {
  if (!__DEV__ || hasReportedMissingKey) {
    return;
  }

  hasReportedMissingKey = true;
  console.error('[Gemini] GEMINI_API_KEY is missing. Add it to your .env file.');
}

function buildRequestBody(
  options: GeminiTextRequestOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{text: options.prompt}],
      },
    ],
  };

  const generationConfig: Record<string, number> = {};

  if (typeof options.temperature === 'number') {
    generationConfig.temperature = options.temperature;
  }

  if (typeof options.maxOutputTokens === 'number') {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }

  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  const instruction = options.systemInstruction?.trim();
  if (instruction) {
    body.systemInstruction = {
      parts: [{text: instruction}],
    };
  }

  return body;
}

function buildModelEndpoint(model: string, method: 'generateContent' | 'streamGenerateContent'): string {
  return `${GEMINI_BASE_MODELS_URL}/${model}:${method}`;
}

function buildRequestUrl(model: string, method: 'generateContent' | 'streamGenerateContent', apiKey: string): string {
  const query =
    method === 'streamGenerateContent' ? 'alt=sse&' : '';
  return `${buildModelEndpoint(model, method)}?${query}key=${encodeURIComponent(apiKey)}`;
}

async function parseFailedResponse(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return `HTTP ${response.status}`;
    }

    const shaped = payload as {
      error?: {
        message?: unknown;
      };
    };

    if (typeof shaped.error?.message === 'string' && shaped.error.message.trim().length > 0) {
      return `${response.status} ${shaped.error.message.trim()}`;
    }
  } catch {
    // Fall through to status-only message.
  }

  return `HTTP ${response.status}`;
}

function parseStreamDataLine(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return null;
  }

  const rawPayload = trimmed.replace(/^data:\s?/, '');
  if (!rawPayload || rawPayload === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(rawPayload) as unknown;
  } catch {
    return null;
  }
}

function getChunkDelta(
  nextText: string,
  emittedText: string,
): {delta: string; emittedText: string} {
  if (!nextText) {
    return {delta: '', emittedText};
  }

  if (nextText.startsWith(emittedText)) {
    return {
      delta: nextText.slice(emittedText.length),
      emittedText: nextText,
    };
  }

  if (emittedText.endsWith(nextText)) {
    return {delta: '', emittedText};
  }

  return {
    delta: nextText,
    emittedText: emittedText + nextText,
  };
}

function extractGeminiText(payload: unknown): string {
  if (Array.isArray(payload)) {
    return payload
      .map(item => extractGeminiText(item))
      .filter(Boolean)
      .join('');
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const shaped = payload as GeminiResponseShape;
  if (!Array.isArray(shaped.candidates)) {
    return '';
  }

  const chunks: string[] = [];

  for (const candidate of shaped.candidates) {
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (typeof part.text === 'string' && part.text.length > 0) {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('');
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

export async function generateGeminiText(
  options: GeminiTextRequestOptions,
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    reportMissingGeminiKey();
    return null;
  }

  const requestBody = JSON.stringify(buildRequestBody(options));

  for (const model of GEMINI_MODELS) {
    try {
      logGeminiDebug(`${model} generateContent request started.`);

      const response = await fetch(buildRequestUrl(model, 'generateContent', apiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const issue = await parseFailedResponse(response);
        logGeminiRequestIssue(`${model} generateContent failed: ${issue}`);
        continue;
      }

      const payload: unknown = await response.json();
      const text = extractGeminiText(payload).trim();
      if (text.length > 0) {
        logGeminiDebug(`${model} generateContent succeeded (${text.length} chars).`);
        return text;
      }

      logGeminiRequestIssue(`${model} generateContent returned empty text.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'network error';
      logGeminiRequestIssue(`${model} generateContent failed: ${reason}`);
    }
  }

  logGeminiRequestIssue('generateContent failed for all configured models.');

  return null;
}

export async function runGeminiHealthCheck(): Promise<GeminiHealthCheckResult> {
  logGeminiDebug('Running Gemini health check.');

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    reportMissingGeminiKey();

    const result: GeminiHealthCheckResult = {
      ok: false,
      status: 'missing-key',
      detail: 'GEMINI_API_KEY is missing or empty.',
    };

    logGeminiRequestIssue(
      `Health check failed (${result.status}): ${result.detail}`,
    );

    return result;
  }

  const generated = await generateGeminiText({
    prompt: HEALTH_CHECK_PROMPT,
    systemInstruction: HEALTH_CHECK_SYSTEM_INSTRUCTION,
    temperature: 0,
    maxOutputTokens: 8,
  });

  if (!generated || generated.trim().length === 0) {
    const result: GeminiHealthCheckResult = {
      ok: false,
      status: 'request-failed',
      detail: 'No text returned from Gemini generateContent.',
    };

    logGeminiRequestIssue(
      `Health check failed (${result.status}): ${result.detail}`,
    );

    return result;
  }

  const result: GeminiHealthCheckResult = {
    ok: true,
    status: 'success',
    detail: `Received ${generated.trim().length} chars.`,
  };

  logGeminiDebug(`Health check passed: ${result.detail}`);

  return result;
}

export function streamGeminiText({
  onChunk,
  onDone,
  onError,
  timeout = DEFAULT_TIMEOUT_MS,
  ...requestOptions
}: GeminiStreamTextOptions): () => void {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    reportMissingGeminiKey();
    onError();
    return () => {};
  }

  logGeminiDebug('Streaming Gemini request started.');

  let hasErrored = false;
  let hasDone = false;
  let isAborted = false;
  let hasReceivedChunk = false;
  let hasLoggedFirstChunk = false;
  let emittedText = '';
  let lastProcessedIndex = 0;
  let pendingLine = '';
  let modelIndex = 0;
  let activeXhr: XMLHttpRequest | null = null;
  let hasStartedNonStreamFallback = false;

  const safeOnError = () => {
    if (hasErrored || hasDone || isAborted) {
      return;
    }

    logGeminiRequestIssue('streamGenerateContent failed without usable output.');
    hasErrored = true;
    onError();
  };

  const safeOnDone = () => {
    if (hasErrored || hasDone || isAborted) {
      return;
    }

    logGeminiDebug(`streamGenerateContent completed (${emittedText.length} chars).`);
    hasDone = true;
    onDone();
  };

  const handlePayload = (payload: unknown) => {
    if (hasErrored || hasDone || isAborted) {
      return;
    }

    const nextText = extractGeminiText(payload);
    if (!nextText) {
      return;
    }

    const {delta, emittedText: updatedText} = getChunkDelta(nextText, emittedText);
    emittedText = updatedText;

    if (delta.length > 0) {
      if (!hasLoggedFirstChunk) {
        hasLoggedFirstChunk = true;
        logGeminiDebug(
          `${GEMINI_MODELS[modelIndex]} streamGenerateContent received first chunk.`,
        );
      }

      hasReceivedChunk = true;
      onChunk(delta);
    }
  };

  const processBuffer = (text: string, flush: boolean = false) => {
    const newText = text.slice(lastProcessedIndex);
    lastProcessedIndex = text.length;

    if (!newText && !flush) {
      return;
    }

    const combined = pendingLine + newText;
    const lines = combined.split('\n');
    const trailingLine = lines.pop() ?? '';

    pendingLine = flush ? '' : trailingLine;

    for (const line of lines) {
      const parsed = parseStreamDataLine(line);
      if (parsed) {
        handlePayload(parsed);
      }
    }

    if (flush && trailingLine.trim().length > 0) {
      const trailing = parseStreamDataLine(trailingLine);
      if (trailing) {
        handlePayload(trailing);
      }
    }
  };

  const tryNonStreamFallback = () => {
    if (
      hasStartedNonStreamFallback ||
      hasReceivedChunk ||
      hasErrored ||
      hasDone ||
      isAborted
    ) {
      return;
    }

    hasStartedNonStreamFallback = true;

    logGeminiRequestIssue(
      'Streaming failed for all models. Retrying with non-stream generateContent.',
    );

    const runFallback = async () => {
      const text = await generateGeminiText(requestOptions);

      if (hasErrored || hasDone || isAborted) {
        return;
      }

      if (!text || text.trim().length === 0) {
        safeOnError();
        return;
      }

      hasReceivedChunk = true;
      emittedText = text;
      logGeminiDebug(`Non-stream fallback succeeded (${text.length} chars).`);
      onChunk(text);
      safeOnDone();
    };

    runFallback().catch(() => {
      safeOnError();
    });
  };

  const requestBody = JSON.stringify(buildRequestBody(requestOptions));

  const tryNextModel = (reason: string): boolean => {
    if (hasReceivedChunk) {
      return false;
    }

    const nextIndex = modelIndex + 1;
    if (nextIndex >= GEMINI_MODELS.length) {
      return false;
    }

    const currentModel = GEMINI_MODELS[modelIndex];
    const nextModel = GEMINI_MODELS[nextIndex];
    logGeminiRequestIssue(
      `${currentModel} stream failed (${reason}). Retrying with ${nextModel}.`,
    );

    modelIndex = nextIndex;
    emittedText = '';
    lastProcessedIndex = 0;
    pendingLine = '';
    startModelStream();
    return true;
  };

  const startModelStream = () => {
    const model = GEMINI_MODELS[modelIndex];
    const xhr = new XMLHttpRequest();
    activeXhr = xhr;

    logGeminiDebug(`${model} streamGenerateContent request started.`);

    xhr.open('POST', buildRequestUrl(model, 'streamGenerateContent', apiKey));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.timeout = timeout;

    xhr.onprogress = () => {
      if (xhr !== activeXhr || hasErrored || hasDone || isAborted) {
        return;
      }

      try {
        processBuffer(xhr.responseText);
      } catch {
        // Partial chunks can be retried when the next progress event arrives.
      }
    };

    xhr.onload = () => {
      if (xhr !== activeXhr || hasErrored || hasDone || isAborted) {
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        if (tryNextModel(`HTTP ${xhr.status}`)) {
          return;
        }

        tryNonStreamFallback();
        return;
      }

      try {
        processBuffer(xhr.responseText, true);
      } catch {
        if (tryNextModel('response parse error')) {
          return;
        }

        tryNonStreamFallback();
        return;
      }

      if (emittedText.trim().length === 0) {
        if (tryNextModel('empty output')) {
          return;
        }

        tryNonStreamFallback();
        return;
      }

      safeOnDone();
    };

    xhr.onerror = () => {
      if (xhr !== activeXhr || hasErrored || hasDone || isAborted) {
        return;
      }

      if (tryNextModel('network error')) {
        return;
      }

      tryNonStreamFallback();
    };

    xhr.ontimeout = () => {
      if (xhr !== activeXhr || hasErrored || hasDone || isAborted) {
        return;
      }

      if (tryNextModel('timeout')) {
        return;
      }

      tryNonStreamFallback();
    };

    xhr.send(requestBody);
  };

  startModelStream();

  return () => {
    if (isAborted) {
      return;
    }

    isAborted = true;
    activeXhr?.abort();
  };
}
