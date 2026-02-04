import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';

/**
 * Curated list of gentle, supportive affirmations
 * Non-clinical, non-prescriptive, emotionally safe
 */
const AFFIRMATIONS = [
  "Small steps still count.",
  "You're doing the best you can right now.",
  "It's okay to not be okay.",
  "Your feelings are valid.",
  "Take things one moment at a time.",
  "You deserve kindness, especially from yourself.",
  "Progress isn't always visible, but it's there.",
  "You've gotten through difficult days before.",
  "Rest is not a reward—it's a need.",
  "You're stronger than you think.",
  "It's okay to ask for space.",
  "You don't have to have it all figured out.",
  "Your pace is valid.",
  "You're allowed to feel however you feel.",
  "Taking care of yourself is important.",
];

interface DailyAffirmationProps {
  // Optional: pass a date to get consistent affirmation per day
  date?: Date;
}

/**
 * Daily Affirmation Card
 * Shows a gentle, supportive message that changes per day
 */
export const DailyAffirmation: React.FC<DailyAffirmationProps> = ({
  date = new Date(),
}) => {
  // Get consistent affirmation based on date (same day = same affirmation)
  const affirmation = useMemo(() => {
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
  }, [date]);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
          <Text style={styles.label} allowFontScaling maxFontSizeMultiplier={1.3}>
            Daily Reminder
          </Text>
          <Text style={styles.affirmation} allowFontScaling maxFontSizeMultiplier={1.3}>
            {affirmation}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.primary.subtle, // Gentle background tint
  },
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl, // Premium padding
    paddingHorizontal: theme.spacing.lg, // More horizontal space
  },
  label: {
    fontSize: theme.typography.fontSize.sm, // Slightly larger
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.md, // More spacing
    textTransform: 'uppercase',
    letterSpacing: 1, // More letter spacing for premium feel
  },
  affirmation: {
    fontSize: theme.typography.fontSize.xl, // Larger - more presence
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.xl * theme.typography.lineHeight.relaxed, // More breathing room
    paddingHorizontal: theme.spacing.lg, // More padding
  },
});





