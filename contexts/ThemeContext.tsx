/**
 * Simplified Theme Context
 * Provides background color throughout the app
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useBackgroundColor } from '~app/hooks/use-background-color';

interface ThemeContextType {
  backgroundColor: string;
  colorId: string;
  refreshBackgroundColor: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { backgroundColor, colorId, refresh } = useBackgroundColor();

  return (
    <ThemeContext.Provider
      value={{
        backgroundColor,
        colorId,
        refreshBackgroundColor: refresh,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

