/**
 * TourFirstRun — offers (never forces) the first-run guided tour.
 *
 * Rendered inside Home. Sequencing rules, in order:
 *   1. Wait until Home's 5km suggest-a-place gate has evaluated
 *      (tourStore.suggestGateDecided) — or a 4s fallback for the cases where
 *      the gate can never decide (location permission denied, sites fetch
 *      failing). This guarantees the tour and the SuggestSite modal never
 *      auto-navigate at the same time.
 *   2. Wait until Home is actually focused (if the gate opened the
 *      SuggestSite modal, the offer appears after the user closes it).
 *   3. Ask with a heritage-styled dialog instead of hijacking the screen:
 *      "Take the tour" starts it; "Explore on my own" (or scrim-dismiss)
 *      declines — an explicit decline persists so it never re-asks; a scrim
 *      dismiss re-offers on the next fresh launch.
 *
 * The tour can always be replayed from Account → "Replay app tour".
 */
import React, {useEffect, useRef} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTourStore} from '../../stores/tourStore';
import {AppAlert} from '../../shared/ui/appAlert';

const GATE_FALLBACK_MS = 4000;

const TourFirstRun: React.FC = () => {
  const {t} = useTranslation();
  const isFocused = useIsFocused();
  const gateDecided = useTourStore(s => s.suggestGateDecided);
  const [gateTimedOut, setGateTimedOut] = React.useState(false);
  const offeredRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setGateTimedOut(true), GATE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (offeredRef.current) return;
    if (!isFocused) return;
    if (!gateDecided && !gateTimedOut) return;

    let cancelled = false;
    (async () => {
      const offer = await useTourStore.getState().shouldOfferFirstRun();
      if (cancelled || offeredRef.current || !offer) return;
      offeredRef.current = true;
      AppAlert.confirm({
        title: t('tour.offerTitle'),
        message: t('tour.offerBody'),
        confirmText: t('tour.offerStart'),
        cancelText: t('tour.offerSkip'),
        onConfirm: () => useTourStore.getState().start(),
        onCancel: () => useTourStore.getState().declineFirstRun(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, gateDecided, gateTimedOut, t]);

  return null;
};

export default TourFirstRun;
