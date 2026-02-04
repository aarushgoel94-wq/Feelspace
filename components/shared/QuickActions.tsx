import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { theme } from '~app/theme';
import { AnimatedQuickAction } from '~app/components/shared/AnimatedQuickAction';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'post-vent',
    title: 'Post a Vent',
    subtitle: 'Share what\'s on your mind',
    icon: '💭',
    route: '/compose',
    color: theme.colors.primary.main,
  },
  {
    id: 'view-rooms',
    title: 'View Rooms',
    subtitle: 'Browse all vent rooms',
    icon: '🏠',
    route: '/(tabs)/explore',
    color: theme.colors.accent.lavender,
  },
  {
    id: 'mood-history',
    title: 'Mood History',
    subtitle: 'See your journey',
    icon: '📊',
    route: '/(tabs)/index', // Will scroll to mood history section
    color: theme.colors.accent.sage,
  },
];

interface QuickActionsProps {
  onMoodHistoryPress?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onMoodHistoryPress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle} allowFontScaling maxFontSizeMultiplier={1.3}>
        Quick Actions
      </Text>
      <View style={styles.actionsContainer}>
        {QUICK_ACTIONS.map((action, index) => (
          <AnimatedQuickAction
            key={action.id}
            action={action}
            index={index}
            onMoodHistoryPress={onMoodHistoryPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize['2xl'], // Large welcoming header
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing['2xl'], // Premium spacing
    lineHeight: theme.typography.fontSize['2xl'] * theme.typography.lineHeight.normal,
  },
  actionsContainer: {
    gap: theme.spacing.md,
  },
});

