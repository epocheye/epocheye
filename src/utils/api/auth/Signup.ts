/**
 * Signup API Module
 * Handles user registration operations
 */

import { AuthResult } from './types';
import { createBaseClient, createErrorResult } from '../helpers';

/**
 * Signup request interface
 */
export interface SignupRequest {
  email: string;
  name: string;
  password: string;
}

/**
 * Signup response interface
 */
export interface SignupResponse {
  message: string;
  uid: string;
}

const apiClient = createBaseClient();

/**
 * Registers a new user
 * @param data - The signup data (email, name, password)
 * @returns AuthResult with signup response or error
 */
export async function signup(
  data: SignupRequest
): Promise<AuthResult<SignupResponse>> {
  try {
    const response = await apiClient.post<SignupResponse>('/signup', data);
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
