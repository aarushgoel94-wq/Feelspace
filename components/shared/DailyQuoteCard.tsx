import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';

// Friendly, inspiring quotes that change daily
const DAILY_QUOTES = [
  "It's okay to feel however you're feeling today.",
  "Your feelings are valid, always.",
  "Take things one moment at a time.",
  "You're doing the best you can.",
  "Be gentle with yourself today.",
  "There's no right or wrong way to feel.",
  "You deserve kindness, especially from yourself.",
  "Small steps still count.",
  "You're stronger than you think.",
  "Progress isn't always visible, but it's there.",
  "You've gotten through difficult days before.",
  "Rest is not a reward—it's a need.",
  "You're allowed to feel however you feel.",
  "Taking care of yourself is important.",
  "Today is a fresh start.",
];

export const DailyQuoteCard: React.FC = () => {
  // Get consistent quote based on date (same day = same quote)
  const quote = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  }, []);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <Card variant="elevated" style={styles.quoteCard}>
        <Text 
          style={styles.quote}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {quote}
        </Text>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  quoteCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary.subtle,
    borderRadius: theme.borderRadius['2xl'],
  },
  quote: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

