import { Tabs, useFocusEffect } from 'expo-router';
import React, { useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';

// Map mood levels to icon names for home tab
// Using SF Symbols names
const MOOD_ICONS: Record<string, string> = {
  'Great': 'star.fill', // Sparkle/stars for great mood
  'Good': 'heart.fill', // Heart for good mood
  'Okay': 'face.smiling', // Smile for okay mood
  'Meh': 'face.smiling', // Neutral smile
  'Low': 'heart', // Empty heart for low mood
};

export default function TabLayout() {
  const [homeIcon, setHomeIcon] = useState('heart.fill');

  // Update home icon based on today's mood
  useFocusEffect(
    React.useCallback(() => {
      const updateHomeIcon = async () => {
        try {
          const todayLog = await storage.getTodaysMoodLog();
          if (todayLog) {
            const iconName = MOOD_ICONS[todayLog.moodLevel] || 'heart.fill';
            setHomeIcon(iconName);
          } else {
            // Default to heart if no mood logged today
            setHomeIcon('heart.fill');
          }
        } catch (error) {
          // Default to heart on error
          setHomeIcon('heart.fill');
        }
      };
      updateHomeIcon();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.light,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          height: 64,
          backgroundColor: theme.colors.background.primary,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={26} 
              name={homeIcon as any} 
              color={color || (focused ? theme.colors.primary.main : theme.colors.text.secondary)} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={26} 
              name="bubble.left.and.bubble.right.fill" 
              color={color || (focused ? theme.colors.primary.main : theme.colors.text.secondary)} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={26} 
              name="bookmark.fill" 
              color={color || (focused ? theme.colors.primary.main : theme.colors.text.secondary)} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null, // Hide from tab bar - admin only
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={26} 
              name="gearshape.fill" 
              color={color || (focused ? theme.colors.primary.main : theme.colors.text.secondary)} 
            />
          ),
        }}
      />
      {/* Keep explore for backward compatibility, but hide it */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
