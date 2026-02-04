import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
}

interface AnimatedQuickActionProps {
  action: QuickAction;
  index: number;
  onPress?: (action: QuickAction) => void;
  onMoodHistoryPress?: () => void;
}

export const AnimatedQuickAction: React.FC<AnimatedQuickActionProps> = ({
  action,
  index,
  onPress,
  onMoodHistoryPress,
}) => {
  const router = useRouter();
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  const handlePressIn = () => {
    buttonScale.value = withTiming(0.97, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });
    buttonOpacity.value = withTiming(0.9, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });
  };

  const handlePressOut = () => {
    buttonScale.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
    buttonOpacity.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  };

  const handlePress = () => {
    if (action.id === 'mood-history') {
      if (onMoodHistoryPress) {
        onMoodHistoryPress();
      } else {
        router.push('/mood-history');
      }
    } else if (onPress) {
      onPress(action);
    } else {
      router.push(action.route as any);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={buttonAnimatedStyle}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          setTimeout(() => {
            handlePress();
          }, 150);
        }}
      >
        <Card variant="elevated" style={[styles.card, { borderLeftColor: action.color, borderLeftWidth: 4 }]}>
          <View style={styles.actionContent}>
            <Text style={styles.icon} allowFontScaling>{action.icon}</Text>
            <View style={styles.textContainer}>
              <Text style={styles.actionTitle} allowFontScaling maxFontSizeMultiplier={1.3}>
                {action.title}
              </Text>
              <Text style={styles.actionSubtitle} allowFontScaling maxFontSizeMultiplier={1.3}>
                {action.subtitle}
              </Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  actionCard: {
    width: '100%',
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xl, // Premium padding
    minHeight: 80, // Larger touch target
  },
  icon: {
    fontSize: 36, // Larger icon
    marginRight: theme.spacing.lg, // More spacing
  },
  textContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: theme.typography.fontSize.xl, // Calm subheading
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.fontSize.xl * theme.typography.lineHeight.normal,
  },
  actionSubtitle: {
    fontSize: theme.typography.fontSize.base, // Lightweight body text
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
});

