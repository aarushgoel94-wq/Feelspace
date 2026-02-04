import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { triggerHapticImpact } from '~app/utils/haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '~app/theme';
import { CALM_EASING, ANIMATION_DURATION, SCALE } from '~app/utils/animations';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'accent';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    // Soft haptic feedback on press
    triggerHapticImpact();
    scale.value = withTiming(SCALE.press, {
      duration: ANIMATION_DURATION.micro,
      easing: CALM_EASING.smooth,
    });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: ANIMATION_DURATION.quick,
      easing: CALM_EASING.smooth,
    });
  };

  const backgroundColor =
    variant === 'primary' ? theme.colors.primary.main : theme.colors.accent.lavender;

  return (
    <AnimatedTouchable
      style={[
        styles.button,
        { backgroundColor },
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text.inverse} size="small" />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.lg, // Increased - larger touch target
    paddingHorizontal: theme.spacing.xl, // Increased - more breathing room
    borderRadius: theme.borderRadius['2xl'], // Softer, premium feel
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60, // Increased from 56 - Apple Health style larger targets
    ...theme.shadows.small, // Softer shadow
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.medium,
  },
  disabled: {
    opacity: 0.7, // Less faded - still visible and functional
    backgroundColor: theme.colors.border.light,
  },
});


