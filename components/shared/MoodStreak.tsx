import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { calculateMoodStreak, formatStreakMessage } from '~app/utils/moodStreak';

export const MoodStreak: React.FC = () => {
  const [streakMessage, setStreakMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadStreak = async () => {
      try {
        const allLogs = await storage.getAllMoodLogs();
        const streak = calculateMoodStreak(allLogs);
        const message = formatStreakMessage(streak);
        setStreakMessage(message);
      } catch (error) {
        // Silently handle errors
        setStreakMessage(null);
      }
    };

    loadStreak();
  }, []);

  if (!streakMessage) return null;

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
          <Text style={styles.icon} allowFontScaling>💛</Text>
          <Text 
            style={styles.text}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            {streakMessage}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
});

