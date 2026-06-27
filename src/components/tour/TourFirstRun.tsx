/**
 * TourFirstRun — fires the first-run guided tour once the user lands on Home
 * after onboarding/login. Renders nothing; the tour UI lives in TourHost (root).
 * Replaces the old OnboardingTooltips card.
 */
import React, {useEffect} from 'react';
import {useTourStore} from '../../stores/tourStore';

const TourFirstRun: React.FC = () => {
  useEffect(() => {
    // Small delay so Home paints before the tour overlay takes over.
    const t = setTimeout(() => {
      void useTourStore.getState().maybeStartFirstRun();
    }, 700);
    return () => clearTimeout(t);
  }, []);
  return null;
};

export default TourFirstRun;
