interface SSEStreamConfig {
  url: string;
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  timeout?: number;
  onMessage: (data: Record<string, unknown>) => void;
  onError: () => void;
}

const DEFAULT_TIMEOUT_MS = 30000;

function isFormDataBody(
  value: Record<string, unknown> | FormData,
): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function parseDataLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return null;
  }

  const rawPayload = trimmed.replace(/^data:\s?/, '');
  if (!rawPayload) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(rawPayload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createSSEStream({
  url,
  body,
  headers,
  timeout = DEFAULT_TIMEOUT_MS,
  onMessage,
  onError,
}: SSEStreamConfig): () => void {
  let hasErrored = false;
  let hasTerminalMessage = false;
  let isAborted = false;
  let lastProcessedIndex = 0;
  let pendingLine = '';

  const safeOnError = () => {
    if (hasErrored || hasTerminalMessage || isAborted) {
      return;
    }
    hasErrored = true;
    onError();
  };

  const handleMessage = (payload: Record<string, unknown>) => {
    const messageType = payload.type;

    if (messageType === 'error') {
      onMessage(payload);
      safeOnError();
      hasTerminalMessage = true;
      return;
    }

    if (messageType === 'done') {
      hasTerminalMessage = true;
      onMessage(payload);
      return;
    }

    onMessage(payload);
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
      const parsed = parseDataLine(line);
      if (parsed) {
        handleMessage(parsed);
      }
    }

    if (flush && trailingLine.trim().length > 0) {
      const trailing = parseDataLine(trailingLine);
      if (trailing) {
        handleMessage(trailing);
      }
    }
  };

  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
  }

  const hasContentTypeHeader =
    Boolean(headers?.['Content-Type']) || Boolean(headers?.['content-type']);

  if (body && !isFormDataBody(body) && !hasContentTypeHeader) {
    xhr.setRequestHeader('Content-Type', 'application/json');
  }

  xhr.onprogress = () => {
    try {
      processBuffer(xhr.responseText);
    } catch {
      // The partial chunk can be reprocessed safely on the next event.
    }
  };

  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      safeOnError();
      return;
    }

    try {
      processBuffer(xhr.responseText, true);
    } catch {
      safeOnError();
      return;
    }

    if (!hasTerminalMessage && !hasErrored) {
      safeOnError();
    }
  };

  xhr.onerror = safeOnError;
  xhr.ontimeout = safeOnError;
  xhr.timeout = timeout;

  if (typeof body === 'undefined') {
    xhr.send();
  } else if (isFormDataBody(body)) {
    xhr.send(body);
  } else {
    xhr.send(JSON.stringify(body));
  }

  return () => {
    isAborted = true;
    xhr.abort();
  };
}
