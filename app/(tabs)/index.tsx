import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CALM_EASING, ANIMATION_DURATION } from '~app/utils/animations';
import { triggerHapticNotification } from '~app/utils/haptics';
import { MicroFeedback } from '~app/components/shared/MicroFeedback';
import { DailyMoodCheckIn } from '~app/components/shared/DailyMoodCheckIn';
import { GreetingSection } from '~app/components/shared/GreetingSection';
import { GentleActions } from '~app/components/shared/GentleActions';
import { MoodHistorySnapshot } from '~app/components/shared/MoodHistorySnapshot';
import { DailyQuoteCard } from '~app/components/shared/DailyQuoteCard';
import { theme } from '~app/theme';
import { MoodLevel } from '~app/models/types';
import { storage } from '~app/models/storage';
import { getTodayDateString } from '~app/models/moodLogUtils';
import { api } from '~app/services/api';
import { getDeviceId } from '~app/utils/deviceId';
import { useTheme } from '~app/contexts/ThemeContext';

export default function HomeScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  
  const [todayMoodCompleted, setTodayMoodCompleted] = useState(false);
  const [showMoodLoggedFeedback, setShowMoodLoggedFeedback] = useState(false);
  const opacity = useSharedValue(0);

  // Smooth fade-in animation on mount
  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: ANIMATION_DURATION.standard,
      easing: CALM_EASING.smooth,
    });
  }, []);

  // Check if mood was logged today
  useEffect(() => {
    const checkTodayMood = async () => {
      try {
        const deviceId = await getDeviceId();
        // Try backend first
        try {
          const todayLog = await api.getTodaysMoodLog(deviceId);
          setTodayMoodCompleted(!!todayLog);
          // Sync to local storage
          if (todayLog) {
            const existing = await storage.getTodaysMoodLog();
            if (!existing || existing.id !== todayLog.id) {
              await storage.createMoodLog({
                date: todayLog.date,
                moodLevel: todayLog.moodLevel,
                note: todayLog.note || undefined,
              });
            }
          }
        } catch (apiError) {
          // Fallback to local storage
          const todayLog = await storage.getTodaysMoodLog();
          setTodayMoodCompleted(!!todayLog);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error checking today\'s mood:', error);
        }
      }
    };
    checkTodayMood();
  }, []);

  const handleMoodSelected = async (mood: MoodLevel, note?: string) => {
    try {
      const deviceId = await getDeviceId();
      const todayDate = getTodayDateString();
      
      // Try to save to backend first
      try {
        const todayLog = await api.getTodaysMoodLog(deviceId);
        if (todayLog) {
          // Update existing log
          const updated = await api.updateMoodLog(todayLog.id, {
            moodLevel: mood,
            note: note || undefined,
          });
          // Also save to local storage (convert backend format to local)
          const existing = await storage.getMoodLogByDate(updated.date);
          if (existing) {
            await storage.updateMoodLog(existing.id, {
              moodLevel: updated.moodLevel,
              note: updated.note || undefined,
            });
          } else {
            await storage.createMoodLog({
              date: updated.date,
              moodLevel: updated.moodLevel,
              note: updated.note || undefined,
            });
          }
        } else {
          // Create new log
          const created = await api.createMoodLog({
            deviceId,
            date: todayDate,
            moodLevel: mood,
            note: note || undefined,
          });
          // Also save to local storage
          await storage.createMoodLog({
            date: created.date,
            moodLevel: created.moodLevel,
            note: created.note || undefined,
          });
        }
      } catch (apiError) {
        // Queue for sync later if API fails
        try {
          const { offlineSync } = await import('~app/services/offlineSync');
          const todayLog = await storage.getTodaysMoodLog();
          if (todayLog) {
            await offlineSync.queueAction('mood_log', 'update', {
              id: todayLog.id,
              deviceId,
              date: todayDate,
              moodLevel: mood,
              note: note || undefined,
            });
          } else {
            // Save to local storage first
            const localLog = await storage.createMoodLog({
              date: todayDate,
              moodLevel: mood,
              note: note || undefined,
            });
            await offlineSync.queueAction('mood_log', 'create', {
              id: localLog.id,
              deviceId,
              date: todayDate,
              moodLevel: mood,
              note: note || undefined,
            });
          }
        } catch (syncError) {
          // Fallback to local storage if queueing fails
          try {
            await storage.createMoodLog({
              date: todayDate,
              moodLevel: mood,
              note: note || undefined,
            });
          } catch (storageError: any) {
            // If mood log already exists for today, try updating it
            if (storageError.message?.includes('already exists')) {
              const todayLog = await storage.getTodaysMoodLog();
              if (todayLog) {
                await storage.updateMoodLog(todayLog.id, {
                  moodLevel: mood,
                  note: note || undefined,
                });
              }
            }
          }
        }
      }
      setTodayMoodCompleted(true);
      
      // Soft haptic feedback
      triggerHapticNotification();
      
      // Show gentle feedback
      setShowMoodLoggedFeedback(true);
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving mood:', error);
      }
    }
  };

  // Removed handleMoodHistoryPress - no longer needed with new layout

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const styles = createStyles(backgroundColor);

  const dynamicStyles = StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: Math.max(insets.top + theme.spacing.xs, theme.spacing.sm),
      paddingBottom: theme.spacing.sm,
    },
  });

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="normal"
      >
        {/* 1. Greeting Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.greetingSection}>
          <GreetingSection />
        </Animated.View>

        {/* Subtle divider */}
        <View style={styles.divider} />

        {/* 2. Daily Mood Check-in - Visually Prominent */}
        <View style={styles.moodCheckInSection}>
          <DailyMoodCheckIn
            onMoodSelected={handleMoodSelected}
            completedToday={todayMoodCompleted}
          />
        </View>

        {/* Subtle divider */}
        <View style={styles.divider} />

        {/* 3. Mood History Visualization */}
        <View style={styles.moodHistorySection}>
          <MoodHistorySnapshot />
        </View>

        {/* Subtle divider */}
        <View style={styles.divider} />

        {/* 4. Daily Quote */}
        <View style={styles.quoteSection}>
          <DailyQuoteCard />
        </View>

        {/* Subtle divider */}
        <View style={styles.divider} />

        {/* 5. Gentle Action Area */}
        <View style={styles.actionsSection}>
          <GentleActions />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {/* Micro feedback - gentle acknowledgment */}
      <MicroFeedback
        message="Logged"
        visible={showMoodLoggedFeedback}
        icon="✓"
        onComplete={() => setShowMoodLoggedFeedback(false)}
      />
    </Animated.View>
  );
}

const createStyles = (backgroundColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgroundColor,
  },
  scrollView: {
    flex: 1,
  },
  greetingSection: {
    marginBottom: theme.spacing.sm,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.colors.border.light,
    opacity: 0.15,
    marginVertical: theme.spacing.sm,
  },
  moodCheckInSection: {
    marginBottom: theme.spacing.sm,
  },
  moodHistorySection: {
    marginBottom: theme.spacing.sm,
  },
  quoteSection: {
    marginBottom: theme.spacing.sm,
  },
  actionsSection: {
    marginBottom: theme.spacing.sm,
  },
  bottomSpacer: {
    height: theme.spacing.md,
  },
});
