'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingStep1 from '@/components/onboarding/OnboardingStep1';
import OnboardingStep2 from '@/components/onboarding/OnboardingStep2';
import LoginForm from '@/components/auth/LoginForm';
import TabNavigation from '@/components/layout/TabNavigation';

export default function Home() {
  const { user, loading } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);

  useEffect(() => {
    const onboardingStatus = localStorage.getItem('hasCompletedOnboarding');
    setHasCompletedOnboarding(onboardingStatus === 'true');
  }, []);

  const handleOnboardingNext = () => {
    setCurrentOnboardingStep(1);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    setHasCompletedOnboarding(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  // Onboarding flow
  if (!hasCompletedOnboarding) {
    if (currentOnboardingStep === 0) {
      return <OnboardingStep1 onNext={handleOnboardingNext} />;
    } else {
      return <OnboardingStep2 onComplete={handleOnboardingComplete} />;
    }
  }

  // Authentication flow
  if (!user) {
    return <LoginForm />;
  }

  // Main app
  return <TabNavigation />;
}
