/**
 * Validators
 * Pure utility functions for input validation
 */

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Standard email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim());
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message: string;
} {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password must be less than 128 characters' };
  }

  // Check for at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      message: 'Password must contain at least one letter and one number',
    };
  }

  return { isValid: true, message: '' };
}

/**
 * Check if a string is empty or only whitespace
 * @param value - String to check
 * @returns true if empty or whitespace only
 */
export function isEmpty(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Check if a string is not empty and not only whitespace
 * @param value - String to check
 * @returns true if has content
 */
export function isNotEmpty(value: string | null | undefined): boolean {
  return !isEmpty(value);
}

/**
 * Validate minimum length
 * @param value - String to check
 * @param minLength - Minimum length required
 * @returns true if meets minimum length
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return typeof value === 'string' && value.length >= minLength;
}

/**
 * Validate maximum length
 * @param value - String to check
 * @param maxLength - Maximum length allowed
 * @returns true if within maximum length
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return typeof value === 'string' && value.length <= maxLength;
}

/**
 * Validate length is within range
 * @param value - String to check
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns true if within range
 */
export function isLengthInRange(
  value: string,
  min: number,
  max: number
): boolean {
  return hasMinLength(value, min) && hasMaxLength(value, max);
}

/**
 * Validate name format (letters, spaces, and common name characters)
 * @param name - Name to validate
 * @returns true if valid name format
 */
export function isValidName(name: string): boolean {
  if (isEmpty(name)) {
    return false;
  }

  // Allow letters, spaces, hyphens, apostrophes, and periods
  const namePattern = /^[a-zA-Z\s\-'.]+$/;
  return namePattern.test(name.trim()) && name.trim().length >= 2;
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid phone format
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) {
    return false;
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check if it's a valid phone number (10-15 digits, optionally starting with +)
  const phonePattern = /^\+?[0-9]{10,15}$/;
  return phonePattern.test(cleaned);
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns true if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if value is a number
 * @param value - Value to check
 * @returns true if valid number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate if value is a positive number
 * @param value - Value to check
 * @returns true if positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  return isNumber(value) && value > 0;
}

/**
 * Validate if value is within numeric range
 * @param value - Value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns true if within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return isNumber(value) && value >= min && value <= max;
}
