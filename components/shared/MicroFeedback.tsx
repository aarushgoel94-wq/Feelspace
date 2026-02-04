/**
 * Small visual acknowledgment component
 * Shows subtle "Logged", "Saved", etc. feedback
 * No loud success screens - just gentle confirmation
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { theme } from '~app/theme';
import { CALM_EASING, ANIMATION_DURATION, SCALE } from '~app/utils/animations';

interface MicroFeedbackProps {
  message: string;
  visible: boolean;
  onComplete?: () => void;
  icon?: string;
}

export const MicroFeedback: React.FC<MicroFeedbackProps> = ({
  message,
  visible,
  onComplete,
  icon,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (visible) {
      // Gentle fade and scale in
      opacity.value = withTiming(1, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      });
      scale.value = withTiming(1, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      });
      translateY.value = withTiming(0, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      });

      // Auto-hide after showing
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, {
          duration: ANIMATION_DURATION.quick,
          easing: CALM_EASING.smooth,
        });
        scale.value = withTiming(0.9, {
          duration: ANIMATION_DURATION.quick,
          easing: CALM_EASING.smooth,
        });
        translateY.value = withTiming(10, {
          duration: ANIMATION_DURATION.quick,
          easing: CALM_EASING.smooth,
        });
        
        setTimeout(() => {
          onComplete?.();
        }, ANIMATION_DURATION.quick);
      }, 2000); // Show for 2 seconds

      return () => clearTimeout(timer);
    } else {
      opacity.value = 0;
      scale.value = 0.9;
      translateY.value = 10;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  if (!visible && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents="none"
    >
      <View style={styles.content}>
        {icon && (
          <Text style={styles.icon} allowFontScaling>
            {icon}
          </Text>
        )}
        <Text style={styles.message} allowFontScaling maxFontSizeMultiplier={1.3}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.medium,
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  message: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

