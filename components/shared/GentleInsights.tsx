import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { generateMoodInsights } from '~app/utils/moodInsights';

export const GentleInsights: React.FC = () => {
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const allLogs = await storage.getAllMoodLogs();
        const generatedInsights = generateMoodInsights(allLogs);
        setInsights(generatedInsights);
      } catch (error) {
        // Silently handle errors
        setInsights([]);
      }
    };

    loadInsights();
  }, []);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
          <Text 
            style={styles.title}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            Gentle insight
          </Text>
          {insights.map((insight, index) => (
            <Text 
              key={index} 
              style={styles.text}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              {insight}
            </Text>
          ))}
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
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xs,
  },
});

