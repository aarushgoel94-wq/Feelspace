import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { triggerHapticImpact } from '~app/utils/haptics';

interface Action {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
}

const GENTLE_ACTIONS: Action[] = [
  {
    id: 'let-it-out',
    title: 'Express yourself',
    subtitle: 'Share what\'s on your mind',
    icon: '💭',
    route: '/compose',
    color: theme.colors.primary.main,
  },
  {
    id: 'browse-rooms',
    title: 'Browse rooms',
    subtitle: 'Find your community',
    icon: '🏠',
    route: '/(tabs)/explore',
    color: theme.colors.accent.lavender,
  },
  {
    id: 'ai-reflections',
    title: 'AI Reflections',
    subtitle: 'Get insights on your vents',
    icon: '🤖',
    route: '/ai-reflections',
    color: theme.colors.accent.sage,
  },
  {
    id: 'reflect',
    title: 'Reflect privately',
    subtitle: 'Your personal space',
    icon: '✨',
    route: '/reflection',
    color: theme.colors.accent.sage,
  },
];

interface GentleActionsProps {
  onActionPress?: (action: Action) => void;
}

export const GentleActions: React.FC<GentleActionsProps> = ({
  onActionPress,
}) => {
  const router = useRouter();

  const handlePress = (action: Action) => {
    triggerHapticImpact();
    if (onActionPress) {
      onActionPress(action);
    } else {
      router.push(action.route as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <Card variant="elevated" style={styles.actionsBox}>
        <View style={styles.actionsContainer}>
          {GENTLE_ACTIONS.map((action, index) => (
            <Animated.View
              key={action.id}
              entering={FadeInDown.delay(index * 100).duration(400)}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handlePress(action)}
                style={styles.actionTouchable}
              >
                <View style={styles.actionContent}>
                  <Text style={styles.actionIcon} allowFontScaling>
                    {action.icon}
                  </Text>
                  <View style={styles.actionTextContainer}>
                    <Text 
                      style={styles.actionTitle} 
                      allowFontScaling 
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                    >
                      {action.title}
                    </Text>
                    <Text 
                      style={styles.actionSubtitle} 
                      allowFontScaling 
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                    >
                      {action.subtitle}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              {index < GENTLE_ACTIONS.length - 1 && <View style={styles.actionDivider} />}
            </Animated.View>
          ))}
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0, // Spacing handled by parent
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.colors.border.light,
    opacity: 0.2,
    marginBottom: theme.spacing.sm,
  },
  actionsBox: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'],
    borderWidth: 0.5,
    borderColor: theme.colors.border.light,
  },
  actionsContainer: {
    gap: 0,
  },
  actionTouchable: {
    width: '100%',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    minHeight: 56,
  },
  actionDivider: {
    height: 0.5,
    backgroundColor: theme.colors.border.light,
    opacity: 0.3,
    marginVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.sm,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs / 2,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
    numberOfLines: 1,
  },
  actionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
    numberOfLines: 1,
  },
});

