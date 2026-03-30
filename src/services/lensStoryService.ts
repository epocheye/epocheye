import {BACKEND_URL} from '../constants/onboarding';
import {getFallbackStory} from './fallbackStories';
import {createSSEStream} from './sseStreamService';

interface LensStoryParams {
  imageUri: string;
  monumentName: string;
  firstName: string;
  regions: string[];
  onChunk: (text: string) => void;
  onDone: (monument: string) => void;
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

  return formData;
}

export function streamLensStory({
  imageUri,
  monumentName,
  firstName,
  regions,
  onChunk,
  onDone,
  onError,
}: LensStoryParams): () => void {
  let hasErrored = false;
  let hasDone = false;

  const safeFallback = () => {
    if (hasErrored || hasDone) {
      return;
    }

    hasErrored = true;
    const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
    console.log('[LensStory] Using fallback story (API error/unavailable)');
    onChunk(fallback.story);
    onDone(fallback.monument);
    onError();
  };

  const handleMessage = (payload: Record<string, unknown>) => {
    const message = payload as {
      type?: string;
      text?: string;
      monument?: string;
    };

    if (message.type === 'chunk' && typeof message.text === 'string') {
      if (!hasErrored && !hasDone) {
        onChunk(message.text);
      }
      return;
    }

    if (message.type === 'done') {
      if (hasErrored || hasDone) {
        return;
      }
      hasDone = true;
      onDone(
        typeof message.monument === 'string' && message.monument.length > 0
          ? message.monument
          : monumentName,
      );
      return;
    }

    if (message.type === 'error') {
      safeFallback();
    }
  };

  const abort = createSSEStream({
    url: `${BACKEND_URL}/api/lens/identify`,
    body: buildLensFormData({
      imageUri,
      monumentName,
      firstName,
      regions,
    }),
    timeout: 30000,
    onMessage: handleMessage,
    onError: safeFallback,
  });

  return () => {
    abort();
  };
}
