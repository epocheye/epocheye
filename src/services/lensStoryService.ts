import {BACKEND_URL} from '../constants/onboarding';
import {getFallbackStory} from './fallbackStories';
import {createSSEStream} from './sseStreamService';

export type LensStoryMode = 'monument' | 'object_scan';

export interface LensIdentifiedObject {
  name: string;
  era: string;
  objectType: string;
}

interface LensStoryParams {
  imageUri: string;
  monumentName: string;
  firstName: string;
  regions: string[];
  motivation?: string;
  mode?: LensStoryMode;
  onChunk: (text: string) => void;
  onDone: (monument: string, object?: LensIdentifiedObject) => void;
  onError: () => void;
}

type RNFile = {
  uri: string;
  type: string;
  name: string;
};

function buildLensFormData({
  imageUri,
  monumentName,
  firstName,
  regions,
}: Pick<
  LensStoryParams,
  'imageUri' | 'monumentName' | 'firstName' | 'regions'
>): FormData {
  const formData = new FormData();

  formData.append(
    'image',
    {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'lens-capture.jpg',
    } as unknown as RNFile,
  );
  formData.append('monumentName', monumentName);
  formData.append('firstName', firstName);
  formData.append('regions', JSON.stringify(regions));
  formData.append('mode', 'monument');

  return formData;
}

function buildObjectScanFormData({
  imageUri,
  monumentName,
  firstName,
  regions,
  motivation,
}: Pick<
  LensStoryParams,
  'imageUri' | 'monumentName' | 'firstName' | 'regions' | 'motivation'
>): FormData {
  const formData = new FormData();

  formData.append(
    'image',
    {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'scan.jpg',
    } as unknown as RNFile,
  );
  formData.append('monumentName', monumentName);
  formData.append('firstName', firstName);
  formData.append('regions', JSON.stringify(regions));
  formData.append('motivation', motivation ?? 'heritage_visitor');
  formData.append('mode', 'object_scan');

  return formData;
}

function parseIdentifiedObject(
  value: unknown,
): LensIdentifiedObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as {
    name?: unknown;
    era?: unknown;
    objectType?: unknown;
  };

  if (
    typeof candidate.name !== 'string' ||
    candidate.name.trim().length === 0 ||
    typeof candidate.era !== 'string' ||
    candidate.era.trim().length === 0 ||
    typeof candidate.objectType !== 'string' ||
    candidate.objectType.trim().length === 0
  ) {
    return undefined;
  }

  return {
    name: candidate.name,
    era: candidate.era,
    objectType: candidate.objectType,
  };
}

export function streamLensStory({
  imageUri,
  monumentName,
  firstName,
  regions,
  motivation,
  mode = 'monument',
  onChunk,
  onDone,
  onError,
}: LensStoryParams): () => void {
  const safeMonumentName = monumentName.trim().length > 0 ? monumentName : 'Unknown Monument';

  let hasErrored = false;
  let hasDone = false;
  let activeAbort: (() => void) | null = null;

  const safeFallback = () => {
    if (hasErrored || hasDone) {
      return;
    }

    hasErrored = true;
    const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
    console.log('[LensStory] Using fallback story (API error/unavailable)');
    onChunk(fallback.story);
    onDone(fallback.monument, undefined);
    onError();
  };

  const handleChunk = (text: string) => {
    if (hasErrored || hasDone || text.length === 0) {
      return;
    }

    onChunk(text);
  };

  const safeOnDone = (monument: string, object?: LensIdentifiedObject) => {
    if (hasErrored || hasDone) {
      return;
    }

    hasDone = true;
    onDone(monument, object);
  };

  const handleBackendFailure = () => {
    if (hasErrored || hasDone) {
      return;
    }

    safeFallback();
  };

  const handleMessage = (payload: Record<string, unknown>) => {
    const message = payload as {
      type?: string;
      text?: string;
      monument?: string;
      object?: unknown;
    };

    if (message.type === 'chunk' && typeof message.text === 'string') {
      handleChunk(message.text);
      return;
    }

    if (message.type === 'done') {
      const identifiedObject = parseIdentifiedObject(message.object);
      safeOnDone(
        typeof message.monument === 'string' && message.monument.length > 0
          ? message.monument
          : safeMonumentName,
        identifiedObject,
      );
      return;
    }

    if (message.type === 'error') {
      handleBackendFailure();
    }
  };

  const body =
    mode === 'object_scan'
      ? buildObjectScanFormData({
          imageUri,
          monumentName,
          firstName,
          regions,
          motivation,
        })
      : buildLensFormData({
          imageUri,
          monumentName,
          firstName,
          regions,
        });

  activeAbort = createSSEStream({
    url: `${BACKEND_URL}/api/lens/identify`,
    body,
    timeout: 30000,
    onMessage: handleMessage,
    onError: handleBackendFailure,
  });

  return () => {
    activeAbort?.();
  };
}
