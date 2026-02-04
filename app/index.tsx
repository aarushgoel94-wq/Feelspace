import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OnboardingFlow } from '~app/components/onboarding/OnboardingFlow';
import { theme } from '~app/theme';

const ONBOARDING_COMPLETE_KEY = '@feelspace:onboarding_complete';

export default function IndexScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Separate effect for navigation to avoid blocking onboarding display
  useEffect(() => {
    if (shouldNavigate && !isLoading) {
      router.replace('/(tabs)');
    }
  }, [shouldNavigate, isLoading, router]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      if (__DEV__) {
        console.log('[Index] Onboarding status check:', onboardingComplete);
      }
      if (onboardingComplete === 'true') {
        // Onboarding already completed, navigate to main app
        if (__DEV__) {
          console.log('[Index] Onboarding complete, navigating to main app');
        }
        setIsLoading(false);
        setShouldNavigate(true);
      } else {
        // First time, show onboarding
        if (__DEV__) {
          console.log('[Index] Onboarding not complete, showing onboarding flow');
        }
        setIsLoading(false);
        setShowOnboarding(true);
      }
    } catch (error: any) {
      console.error('[Index] Error checking onboarding status:', error);
      // On error, assume onboarding not completed - show onboarding
      setIsLoading(false);
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      if (__DEV__) {
        console.log('[Index] Onboarding complete callback called, saving...');
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      if (__DEV__) {
        console.log('[Index] Onboarding completion saved successfully');
      }
    } catch (error: any) {
      console.error('[Index] Error saving onboarding completion:', error);
      // Continue even if storage fails
    }
    // Always navigate to main app
    try {
      if (__DEV__) {
        console.log('[Index] Navigating to main app...');
      }
      router.replace('/(tabs)');
    } catch (navError: any) {
      console.error('[Index] Error navigating to main app:', navError);
      // Try alternative navigation
      try {
        router.push('/(tabs)');
      } catch (pushError: any) {
        console.error('[Index] Alternative navigation also failed:', pushError);
        // Last resort: set navigation flag
        setShouldNavigate(true);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Return loading state while redirecting
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary.main} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
});
