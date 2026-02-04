/**
 * Avatar Context
 * Provides user avatar/icon throughout the app
 * Automatically updates when icon changes
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '~app/models/storage';
import { AppState, AppStateStatus } from 'react-native';

interface AvatarContextType {
  userIcon: string | null;
  refreshIcon: () => Promise<void>;
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [userIcon, setUserIcon] = useState<string | null>(null);

  const loadIcon = async () => {
    try {
      const icon = await storage.getUserIcon();
      setUserIcon(icon);
    } catch (error) {
      console.error('Error loading user icon:', error);
      setUserIcon(null);
    }
  };

  useEffect(() => {
    loadIcon();

    // Listen for app state changes to refresh icon
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadIcon();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Set up a polling interval to check for icon changes
    // This ensures icon updates even without app state changes
    const interval = setInterval(() => {
      loadIcon();
    }, 2000); // Check every 2 seconds

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const refreshIcon = async () => {
    await loadIcon();
  };

  return (
    <AvatarContext.Provider
      value={{
        userIcon,
        refreshIcon,
      }}
    >
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }
  return context;
}
