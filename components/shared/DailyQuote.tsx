import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';

interface DailyQuoteProps {
  quote?: string;
}

const DEFAULT_QUOTES = [
  'Small steps still count.',
  'You are exactly where you need to be.',
  'Progress, not perfection.',
  'Take a deep breath. You\'ve got this.',
  'It\'s okay to feel what you feel.',
  'You are stronger than you know.',
  'Today is a fresh start.',
  'Be gentle with yourself.',
];

export const DailyQuote: React.FC<DailyQuoteProps> = ({
  quote,
}) => {
  // Use provided quote or pick one based on day of year for consistency (same quote per day)
  const getQuoteOfTheDay = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return DEFAULT_QUOTES[dayOfYear % DEFAULT_QUOTES.length];
  };
  
  const displayQuote = quote || getQuoteOfTheDay();

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.content}>
          <Text 
            style={styles.quote}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            {displayQuote}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.primary.subtle,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  content: {
    paddingVertical: theme.spacing.sm,
  },
  quote: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

