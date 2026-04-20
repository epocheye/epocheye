/**
 * Maps Razorpay SDK errors to calm, user-friendly messages.
 *
 * Razorpay throws `{ code, description, source, step, reason }` when payment
 * fails or the user dismisses the sheet. We translate this into plain English
 * instead of surfacing raw SDK strings.
 */

export interface FriendlyPaymentError {
  title: string;
  message: string;
}

interface RazorpayErrorShape {
  code?: string | number;
  description?: string;
  reason?: string;
}

const CANCEL_HINTS = [
  'payment cancelled',
  'payment canceled',
  'cancelled by user',
  'canceled by user',
  'user cancelled',
  'user canceled',
  'back pressed',
];

export function toFriendlyPaymentError(error: unknown): FriendlyPaymentError {
  const e = (error && typeof error === 'object' ? error : {}) as RazorpayErrorShape;
  const desc = (e.description || '').toString().toLowerCase();
  const reason = (e.reason || '').toString().toLowerCase();
  const code = typeof e.code === 'string' ? e.code.toUpperCase() : String(e.code ?? '');

  if (CANCEL_HINTS.some(hint => desc.includes(hint) || reason.includes(hint)) || code === '0' || code === '2') {
    return {
      title: 'Payment cancelled',
      message: 'No worries — you can try again whenever you\'re ready.',
    };
  }

  if (code === 'NETWORK_ERROR' || desc.includes('network') || desc.includes('internet') || desc.includes('timeout')) {
    return {
      title: 'Connection lost',
      message: 'We couldn\'t reach the payment service. Check your internet and try again.',
    };
  }

  if (code === 'GATEWAY_ERROR' || desc.includes('declined') || desc.includes('insufficient') || reason.includes('declined')) {
    return {
      title: 'Payment didn\'t go through',
      message: 'Your bank couldn\'t complete the payment. Try another card, UPI app, or wallet.',
    };
  }

  if (code === 'SERVER_ERROR' || desc.includes('server')) {
    return {
      title: 'Something went wrong',
      message: 'The payment service is having a rough moment. Please try again in a bit.',
    };
  }

  if (code === 'BAD_REQUEST_ERROR') {
    return {
      title: 'Payment couldn\'t start',
      message: 'Those payment details didn\'t work. Please try again or use a different method.',
    };
  }

  return {
    title: 'Payment didn\'t complete',
    message: 'The payment didn\'t go through. Please try again — you haven\'t been charged.',
  };
}

export const VERIFICATION_FAILED_ERROR: FriendlyPaymentError = {
  title: 'Almost there',
  message: 'We received your payment but couldn\'t confirm it yet. Give it a minute — if nothing changes, reach out to support and we\'ll sort it out.',
};

export const ORDER_CREATE_FAILED_ERROR: FriendlyPaymentError = {
  title: 'Couldn\'t start checkout',
  message: 'We couldn\'t open the payment screen. Please try again in a moment.',
};

export const CHECKOUT_NOT_CONFIGURED_ERROR: FriendlyPaymentError = {
  title: 'Payments unavailable',
  message: 'Checkout isn\'t set up on this version of the app. Please update to the latest version.',
};
