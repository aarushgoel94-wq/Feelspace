import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { ThemeProvider } from '~app/contexts/ThemeContext';
import { AvatarProvider } from '~app/contexts/AvatarContext';
import { ErrorBoundary } from '~app/components/shared/ErrorBoundary';
import { offlineSync } from '~app/services/offlineSync';

// Removed initialRouteName to let Expo Router handle routing naturally
// app/index.tsx will handle onboarding check and navigation

export default function RootLayout() {
  // Initialize offline sync on app start
  useEffect(() => {
    // Sync when app starts if online
    offlineSync.sync().catch(() => {
      // Silently fail - sync will retry automatically
    });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AvatarProvider>
            <NavigationThemeProvider value={DefaultTheme}>
              <Stack 
                screenOptions={{ 
                  headerShown: false,
                  animation: Platform.OS === 'ios' ? 'default' : 'fade',
                  animationDuration: 400, // Smooth, calm transitions
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
                <Stack.Screen name="reflection" options={{ presentation: 'modal' }} />
                <Stack.Screen name="ai-reflections" options={{ presentation: 'card' }} />
                <Stack.Screen 
                  name="vent/[id]" 
                  options={{ 
                    presentation: 'card',
                    animation: Platform.OS === 'ios' ? 'default' : 'fade',
                  }} 
                />
                <Stack.Screen 
                  name="room/[roomId]" 
                  options={{ 
                    presentation: 'card',
                    animation: Platform.OS === 'ios' ? 'default' : 'fade',
                  }} 
                />
                <Stack.Screen name="mood-history" options={{ presentation: 'card' }} />
                <Stack.Screen name="moderator-contact" options={{ presentation: 'card' }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </NavigationThemeProvider>
          </AvatarProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
