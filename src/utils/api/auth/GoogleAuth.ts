import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { storeTokens } from './tokenStorage';
import { createBaseClient, getErrorMessage, getStatusCode, isApiError } from '../helpers';
import type { AuthResult, LoginResponse, AuthTokens } from './types';

export async function googleSignIn(): Promise<AuthResult<LoginResponse>> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type !== 'success') {
      return {
        success: false,
        error: { message: 'Sign in cancelled', statusCode: 0 },
      };
    }

    const { idToken } = response.data;
    if (!idToken) {
      return {
        success: false,
        error: { message: 'Unable to get Google ID token', statusCode: 400 },
      };
    }

    const client = createBaseClient();
    const apiResponse = await client.post<LoginResponse>('/auth/google', {
      idToken,
    });

    const loginResponse = apiResponse.data;
    const tokens: AuthTokens = {
      accessToken: loginResponse.accessToken,
      refreshToken: loginResponse.refreshToken,
      accessExpires: loginResponse.accessExpires,
      uid: loginResponse.uid,
    };
    await storeTokens(tokens);

    return { success: true, data: loginResponse };
  } catch (error) {
    if (isErrorWithCode(error)) {
      // Genuine user-driven non-errors stay silent (statusCode 0 → no alert).
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return {
          success: false,
          error: { message: 'Sign in cancelled', statusCode: 0 },
        };
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return {
          success: false,
          error: { message: 'Sign in already in progress', statusCode: 0 },
        };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          success: false,
          error: {
            message: 'Google Play Services not available. Please update and try again.',
            statusCode: 503,
          },
        };
      }
      // Any other coded failure — most commonly DEVELOPER_ERROR (code 10): the
      // app's SHA-1 isn't registered with the OAuth client, or the Web client ID
      // is wrong. Surface it (non-zero statusCode) so it's not a silent no-op.
      return {
        success: false,
        error: {
          message: `Google sign-in failed (code ${String(error.code)}). This usually means this app's SHA-1 fingerprint isn't registered, or the Web client ID is wrong.`,
          statusCode: 10,
        },
      };
    }
    if (isApiError(error)) {
      return {
        success: false,
        error: { message: getErrorMessage(error), statusCode: getStatusCode(error) },
      };
    }
    return {
      success: false,
      error: { message: 'Google sign in failed. Please try again.', statusCode: 500 },
    };
  }
}
