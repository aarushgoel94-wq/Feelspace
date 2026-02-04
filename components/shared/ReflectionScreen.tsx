import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '~app/theme';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { Illustration } from '~app/components/shared/Illustration';

interface ReflectionScreenProps {
  onComplete?: () => void;
}

export const ReflectionScreen: React.FC<ReflectionScreenProps> = ({
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const progressValue = useSharedValue(0);

  useEffect(() => {
    // Start the 5-second progress (50 updates over 5 seconds = 0.02 per 100ms)
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = Math.min(prev + 0.02, 1);
        progressValue.value = withTiming(newProgress, {
          duration: 100,
        });
        
        if (newProgress >= 1) {
          setIsComplete(true);
          clearInterval(interval);
          return 1;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const sliderStyle = useAnimatedStyle(() => {
    const width = progressValue.value * 100;
    return {
      width: `${width}%`,
    };
  });


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          entering={FadeIn.duration(theme.animation.duration.slow)}
          style={styles.content}
        >
          {/* Illustration */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(theme.animation.duration.slow)}
            style={styles.illustrationContainer}
          >
            <Illustration type="waves" />
          </Animated.View>

          {/* Text Container */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(theme.animation.duration.slow)}
            style={styles.textContainer}
          >
            <Text style={styles.question}>Do you feel a little lighter?</Text>
            <Text style={styles.subtext}>
              Take a moment to notice how you feel right now.
            </Text>
          </Animated.View>

          {/* Progress Slider */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(theme.animation.duration.slow)}
            style={styles.sliderContainer}
          >
            <View style={styles.sliderTrack}>
              <Animated.View style={[styles.sliderFill, sliderStyle]} />
            </View>
            <Text style={styles.progressText}>
              {isComplete ? 'Complete' : `${Math.round(5 - progress * 5)}s`}
            </Text>
          </Animated.View>

          {/* Completion Message */}
          {isComplete && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(theme.animation.duration.slow)}
              style={styles.completionContainer}
            >
              <Text style={styles.completionEmoji}>✨</Text>
              <Text style={styles.completionText}>
                You've taken a step toward feeling better.
              </Text>
              <Text style={styles.completionSubtext}>
                Remember, it's okay to feel what you're feeling.
              </Text>
            </Animated.View>
          )}

          {/* Continue Button - shown after completion */}
          {isComplete && (
            <Animated.View
              entering={FadeInDown.delay(400).duration(theme.animation.duration.slow)}
              style={styles.buttonContainer}
            >
              <PrimaryButton
                title="Continue"
                onPress={() => {
                  onComplete?.();
                }}
                style={styles.button}
              />
            </Animated.View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing['3xl'],
  },
  content: {
    width: '100%',
    padding: theme.spacing.xl,
    paddingTop: theme.spacing['2xl'],
    alignItems: 'center',
    minHeight: '100%',
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 200, // Fixed height to prevent squishing
    marginBottom: theme.spacing['2xl'],
    marginTop: theme.spacing.lg,
    zIndex: 1,
    position: 'relative',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.xl,
    width: '100%',
    zIndex: 2,
    position: 'relative',
    backgroundColor: theme.colors.background.primary,
  },
  question: {
    fontSize: 38,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 46,
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
  sliderContainer: {
    width: '100%',
    maxWidth: 320,
    marginBottom: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.md,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.full,
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.full,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.medium,
  },
  completionContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    width: '100%',
  },
  completionEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  completionText: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.fontSize.xl * theme.typography.lineHeight.relaxed,
    fontFamily: theme.typography.fontFamily.semibold,
    paddingHorizontal: theme.spacing.md,
  },
  completionSubtext: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.md,
  },
  moodCheckContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  button: {
    width: '100%',
  },
});

