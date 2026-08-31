/**
 * Object media API module. Wraps /api/v1/objects/* on the Go backend.
 *
 * User-authenticated and, like the audio guide, deliberately NOT scan-quota
 * gated — opening a card is content, not a recognition scan
 * (apis/objectmedia/routes.go says why in full).
 */
export * from './Objects';
export * from './types';
