/**
 * Analytics stub — console.log for now, replace with actual provider later.
 */

export const track = (event: string, props?: Record<string, unknown>) => {
  console.log('[Analytics]', event, props ?? '');
};
