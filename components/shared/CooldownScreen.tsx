/**
 * Cooldown screen shown when user has submitted too many vents
 * Calm, non-judgmental message encouraging a break
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { Illustration } from '~app/components/shared/Illustration';

interface CooldownScreenProps {
  cooldownSeconds: number;
  onComplete?: () => void;
}

export const CooldownScreen: React.FC<CooldownScreenProps> = ({
  cooldownSeconds,
  onComplete,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(cooldownSeconds);
  const breathScale = useSharedValue(1);

  useEffect(() => {
    // Gentle breathing animation
    breathScale.value = withRepeat(
      withTiming(1.05, { duration: 3000, easing: (t) => t }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (onComplete) {
        // Small delay before calling onComplete
        setTimeout(() => onComplete(), 500);
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, onComplete]);

  const animatedBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(theme.animation.duration.slow)}
        style={styles.content}
      >
        {/* Illustration */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(theme.animation.duration.slow)}
          style={styles.illustrationContainer}
        >
          <Animated.View style={animatedBreathStyle}>
            <Illustration type="waves" />
          </Animated.View>
        </Animated.View>

        {/* Message */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(theme.animation.duration.slow)}
          style={styles.textContainer}
        >
          <Text style={styles.message}>Let's take a breath for a moment.</Text>
          <Text style={styles.subtext}>
            You've shared a lot today. Take this time to pause and reflect.
          </Text>
        </Animated.View>

        {/* Timer */}
        {remainingSeconds > 0 && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(theme.animation.duration.slow)}
            style={styles.timerContainer}
          >
            <Text style={styles.timerLabel}>You can share again in</Text>
            <Text style={styles.timer}>{formatTime(remainingSeconds)}</Text>
          </Animated.View>
        )}

        {/* Completion message */}
        {remainingSeconds === 0 && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(theme.animation.duration.normal)}
            style={styles.completeContainer}
          >
            <Text style={styles.completeText}>Ready when you are.</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 200,
    marginBottom: theme.spacing['2xl'],
    marginTop: theme.spacing.lg,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.xl,
  },
  message: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.fontSize['3xl'] * 1.2,
    fontFamily: theme.typography.fontFamily.bold,
  },
  subtext: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.md,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary.subtle,
    borderRadius: theme.borderRadius.xl,
    minWidth: 200,
  },
  timerLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.regular,
  },
  timer: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.bold,
  },
  completeContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
  },
  completeText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.semibold,
  },
});

