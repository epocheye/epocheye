/**
 * Personalized Facts API Module
 * Fetches Gemini-backed personalized facts and elaborates on demand.
 */

import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';
import type {
  ElaborateFactRequest,
  ElaboratedFact,
  PersonalizedFact,
  PersonalizedFactsResponse,
  UserResult,
} from './types';

type FactsResponseShape = {
  facts?: unknown;
  items?: unknown;
};

type ElaborateResponseShape = {
  detail?: unknown;
  explanation?: unknown;
  text?: unknown;
  id?: unknown;
};

const FACTS_ENDPOINTS = [
  '/api/user/facts/personalized',
  '/api/user/personalized-facts',
] as const;

const ELABORATE_ENDPOINTS = [
  '/api/user/facts/elaborate',
  '/api/user/personalized-facts/elaborate',
] as const;

function normalizeFact(input: unknown, index: number): PersonalizedFact | null {
  if (typeof input === 'string') {
    return {
      id: `fact-${index + 1}`,
      headline: 'Heritage insight',
      summary: input,
    };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const raw = input as {
    id?: unknown;
    headline?: unknown;
    title?: unknown;
    summary?: unknown;
    fact?: unknown;
    text?: unknown;
    detail?: unknown;
    explanation?: unknown;
    monument?: unknown;
  };

  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof raw.fact === 'string'
      ? raw.fact
      : typeof raw.text === 'string'
      ? raw.text
      : '';

  if (!summary) {
    return null;
  }

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id
        : `fact-${index + 1}`,
    headline:
      typeof raw.headline === 'string'
        ? raw.headline
        : typeof raw.title === 'string'
        ? raw.title
        : 'Heritage insight',
    summary,
    detail:
      typeof raw.detail === 'string'
        ? raw.detail
        : typeof raw.explanation === 'string'
        ? raw.explanation
        : undefined,
    monument: typeof raw.monument === 'string' ? raw.monument : undefined,
  };
}

function normalizeFactsResponse(data: unknown): PersonalizedFactsResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { facts: [] };
  }

  const shaped = data as FactsResponseShape;
  const list =
    Array.isArray(shaped.facts)
      ? shaped.facts
      : Array.isArray(shaped.items)
      ? shaped.items
      : [];

  const normalized = list
    .map((item, index) => normalizeFact(item, index))
    .filter((fact): fact is PersonalizedFact => !!fact);

  return { facts: normalized };
}

function normalizeElaboration(
  data: unknown,
  fallbackFactId: string,
): ElaboratedFact | null {
  if (typeof data === 'string' && data.trim().length > 0) {
    return {
      id: fallbackFactId,
      detail: data,
    };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const shaped = data as ElaborateResponseShape;
  const detail =
    typeof shaped.detail === 'string'
      ? shaped.detail
      : typeof shaped.explanation === 'string'
      ? shaped.explanation
      : typeof shaped.text === 'string'
      ? shaped.text
      : '';

  if (!detail) {
    return null;
  }

  return {
    id:
      typeof shaped.id === 'string' && shaped.id.trim().length > 0
        ? shaped.id
        : fallbackFactId,
    detail,
  };
}

/**
 * Fetch personalized Gemini-backed facts for the signed-in user.
 */
export async function getPersonalizedFacts(payload: {
  limit?: number;
  userName?: string;
  nearbyPlaces?: string[];
  regionHint?: string;
}): Promise<UserResult<PersonalizedFactsResponse>> {
  try {
    const client = createAuthenticatedClient();
    let lastError: unknown;

    for (const endpoint of FACTS_ENDPOINTS) {
      try {
        const response = await client.post(endpoint, {
          ...payload,
          provider: 'gemini',
        });

        const normalized = normalizeFactsResponse(response.data);
        if (normalized.facts.length > 0) {
          return {
            success: true,
            data: normalized,
          };
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      return createErrorResult(lastError);
    }

    return {
      success: false,
      error: {
        message: 'No personalized facts available right now.',
        statusCode: 0,
      },
    };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Request a deeper elaboration for a single fact.
 */
export async function elaboratePersonalizedFact(
  payload: ElaborateFactRequest,
): Promise<UserResult<ElaboratedFact>> {
  try {
    const client = createAuthenticatedClient();
    let lastError: unknown;

    for (const endpoint of ELABORATE_ENDPOINTS) {
      try {
        const response = await client.post(endpoint, {
          ...payload,
          provider: 'gemini',
        });

        const elaborated = normalizeElaboration(response.data, payload.factId);
        if (elaborated) {
          return {
            success: true,
            data: elaborated,
          };
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      return createErrorResult(lastError);
    }

    return {
      success: false,
      error: {
        message: 'Could not elaborate this fact right now.',
        statusCode: 0,
      },
    };
  } catch (error) {
    return createErrorResult(error);
  }
}
