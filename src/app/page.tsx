'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingStep1 from '@/components/onboarding/OnboardingStep1';
import OnboardingStep2 from '@/components/onboarding/OnboardingStep2';
import LoginForm from '@/components/auth/LoginForm';
import TabNavigation from '@/components/layout/TabNavigation';
import DebugInfo from '@/components/debug/DebugInfo';

export default function Home() {
  try {
    const { user, loading } = useAuth();
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
    const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);

    useEffect(() => {
      try {
        const onboardingStatus = localStorage.getItem('hasCompletedOnboarding');
        setHasCompletedOnboarding(onboardingStatus === 'true');
      } catch (error) {
        console.error('Error accessing localStorage:', error);
      }
    }, []);

    const handleOnboardingNext = () => {
      setCurrentOnboardingStep(1);
    };

    const handleOnboardingComplete = () => {
      try {
        localStorage.setItem('hasCompletedOnboarding', 'true');
        setHasCompletedOnboarding(true);
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        setHasCompletedOnboarding(true); // Proceed anyway
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <DebugInfo />
        </div>
      );
    }

    // Onboarding flow
    if (!hasCompletedOnboarding) {
      if (currentOnboardingStep === 0) {
        return (
          <>
            <OnboardingStep1 onNext={handleOnboardingNext} />
            <DebugInfo />
          </>
        );
      } else {
        return (
          <>
            <OnboardingStep2 onComplete={handleOnboardingComplete} />
            <DebugInfo />
          </>
        );
      }
    }

    // Authentication flow
    if (!user) {
      return (
        <>
          <LoginForm />
          <DebugInfo />
        </>
      );
    }

    // Main app
    return (
      <>
        <TabNavigation />
        <DebugInfo />
      </>
    );
  } catch (error) {
    console.error('Error in Home component:', error);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
          <p className="text-gray-600 mb-4">Something went wrong loading the application.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
        <DebugInfo />
      </div>
    );
  }
}
