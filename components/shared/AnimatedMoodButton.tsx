import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { CALM_EASING, ANIMATION_DURATION, SCALE } from '~app/utils/animations';
import { theme } from '~app/theme';
import { MoodLevel } from '~app/models/types';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';

interface MoodOption {
  emoji: string;
  label: string;
  moodLevel: MoodLevel;
  displayLabel: string;
  color: string;
}

interface AnimatedMoodButtonProps {
  mood: MoodOption;
  isSelected: boolean;
  onPress: (mood: MoodOption) => void;
  disabled: boolean;
  index: number;
}

export const AnimatedMoodButton: React.FC<AnimatedMoodButtonProps> = ({
  mood,
  isSelected,
  onPress,
  disabled,
  index,
}) => {
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  const handlePress = () => {
    // Subtle scale animation - calm, not bouncy
    buttonScale.value = withTiming(SCALE.press, {
      duration: ANIMATION_DURATION.micro,
      easing: CALM_EASING.smooth,
    });
    setTimeout(() => {
      buttonScale.value = withTiming(1, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      });
    }, ANIMATION_DURATION.micro);
    onPress(mood);
  };

  const handlePressIn = () => {
    if (!disabled) {
      buttonScale.value = withTiming(SCALE.press, {
        duration: ANIMATION_DURATION.micro,
        easing: CALM_EASING.smooth,
      });
    }
  };

  const handlePressOut = () => {
    if (!disabled && !isSelected) {
      buttonScale.value = withTiming(1, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      });
    }
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(ANIMATION_DURATION.standard)}
      style={[buttonAnimatedStyle, { flex: 1, minWidth: 0 }]} // Ensure flex works properly
    >
      <TouchableOpacity
        style={[
          styles.moodButton,
          isSelected && [
            styles.moodButtonSelected,
            { backgroundColor: mood.color + '20', borderColor: mood.color },
          ],
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <Text style={styles.moodEmoji} allowFontScaling>{mood.emoji}</Text>
        <Text
          style={[
            styles.moodLabel,
            isSelected && { color: mood.color, fontWeight: '600' },
          ]}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {mood.displayLabel}
        </Text>
        {isSelected && (
          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION.quick)}
            style={[styles.checkmark, { backgroundColor: mood.color }]}
          >
            <Text style={styles.checkmarkText} allowFontScaling maxFontSizeMultiplier={1.3}>✓</Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  moodButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm, // Reduced padding for tighter fit
    paddingHorizontal: theme.spacing.xs / 2, // Even smaller horizontal padding
    borderRadius: theme.borderRadius.lg, // Slightly smaller radius for cleaner look
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    position: 'relative',
    height: 68, // Fixed height for uniformity
    flex: 1, // Equal width distribution
    minWidth: 0, // Allow flex to shrink if needed
    maxWidth: '100%', // Don't exceed container
    ...theme.shadows.small,
  },
  moodButtonSelected: {
    borderWidth: 2,
    ...theme.shadows.medium, // More elevation when selected
  },
  moodEmoji: {
    fontSize: 28, // Slightly smaller for better fit
    marginBottom: theme.spacing.xs / 2, // Reduced spacing
    lineHeight: 28, // Match font size for consistent height
  },
  moodLabel: {
    fontSize: 11, // Reduced from xs (13) to ensure "Tough" fits in one line
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    numberOfLines: 1,
    lineHeight: 13, // Tighter line height
    paddingHorizontal: 1, // Minimal padding
    includeFontPadding: false, // Remove extra font padding on Android
  },
  checkmark: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 20, // Slightly smaller for cleaner look
    height: 20, // Slightly smaller for cleaner look
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: theme.colors.text.inverse,
    fontSize: 12, // Slightly smaller
    fontWeight: 'bold',
    lineHeight: 12,
  },
});

