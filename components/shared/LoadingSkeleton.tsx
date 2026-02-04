import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '~app/theme';
import { Card } from './Card';

interface SkeletonLineProps {
  width: string | number;
  height: number;
  style?: any;
}

const SkeletonLine: React.FC<SkeletonLineProps> = ({ width, height, style }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.border.light,
          borderRadius: theme.borderRadius.sm,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const VentCardSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.header}>
          <SkeletonLine width="40%" height={16} />
          <SkeletonLine width="30%" height={24} style={styles.roomTag} />
        </View>
        <View style={styles.content}>
          <SkeletonLine width="100%" height={14} style={styles.line} />
          <SkeletonLine width="100%" height={14} style={styles.line} />
          <SkeletonLine width="95%" height={14} style={styles.line} />
          <SkeletonLine width="80%" height={14} style={styles.line} />
        </View>
        <View style={styles.reactions}>
          <SkeletonLine width="30%" height={64} style={styles.reactionButton} />
          <SkeletonLine width="30%" height={64} style={styles.reactionButton} />
          <SkeletonLine width="30%" height={64} style={styles.reactionButton} />
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  roomTag: {
    borderRadius: theme.borderRadius.lg,
  },
  content: {
    marginBottom: theme.spacing.xl,
  },
  line: {
    marginBottom: theme.spacing.sm,
  },
  reactions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  reactionButton: {
    borderRadius: theme.borderRadius.lg,
  },
});

