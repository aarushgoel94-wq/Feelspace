import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { theme } from '~app/theme';

interface MoodHeaderProps {
  moodTrend?: 'happy' | 'calm' | 'tired' | 'neutral';
}

/**
 * Minimal, abstract mood header illustration
 * Professional, calm, and clean design
 */
export const MoodHeader: React.FC<MoodHeaderProps> = ({
  moodTrend = 'neutral',
}) => {
  // Subtle pulsing animation for the gradient shape
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  React.useEffect(() => {
    // Gentle breathing effect
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Subtle opacity pulse
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Get colors based on mood trend
  const getGradientColors = () => {
    switch (moodTrend) {
      case 'happy':
        return {
          start: theme.colors.accent.sage,
          end: theme.colors.primary.light,
        };
      case 'calm':
        return {
          start: theme.colors.primary.main,
          end: theme.colors.primary.light,
        };
      case 'tired':
        return {
          start: theme.colors.text.tertiary,
          end: theme.colors.border.light,
        };
      default:
        return {
          start: theme.colors.primary.main,
          end: theme.colors.primary.subtle,
        };
    }
  };

  const colors = getGradientColors();

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.svgContainer, animatedStyle]}>
        <Svg width="140" height="140" viewBox="0 0 140 140">
          <Defs>
            <LinearGradient id="moodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.start} stopOpacity="0.4" />
              <Stop offset="50%" stopColor={colors.start} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={colors.end} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          
          {/* Abstract soft blob shape - minimal and calm */}
          <Path
            d="M 70 20 
               C 90 20, 110 35, 115 55
               C 120 75, 115 95, 100 110
               C 85 125, 55 125, 40 110
               C 25 95, 20 75, 25 55
               C 30 35, 50 20, 70 20 Z"
            fill="url(#moodGradient)"
          />
          
          {/* Subtle inner highlight */}
          <Circle
            cx="65"
            cy="50"
            r="25"
            fill={colors.start}
            opacity="0.15"
          />
          
          {/* Minimal accent dots */}
          <Circle cx="85" cy="45" r="2" fill={colors.start} opacity="0.3" />
          <Circle cx="50" cy="70" r="1.5" fill={colors.end} opacity="0.25" />
          <Circle cx="95" cy="80" r="1.5" fill={colors.start} opacity="0.2" />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    height: 160,
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});





