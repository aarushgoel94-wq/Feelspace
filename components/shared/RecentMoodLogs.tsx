import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { MoodLog } from '~app/models/types';

interface RecentMoodLogsProps {
  moodLogs: MoodLog[];
  onViewAll?: () => void;
}

const MOOD_EMOJI_MAP: Record<string, string> = {
  peaceful: '😌',
  calm: '🧘',
  content: '🙂',
  hopeful: '✨',
  grateful: '💝',
  anxious: '😰',
  tired: '😴',
  overwhelmed: '😵',
  sad: '😢',
  angry: '😠',
  numb: '😐',
  mixed: '🤷',
};

const MOOD_LABEL_MAP: Record<string, string> = {
  peaceful: 'Peaceful',
  calm: 'Calm',
  content: 'Content',
  hopeful: 'Hopeful',
  grateful: 'Grateful',
  anxious: 'Anxious',
  tired: 'Tired',
  overwhelmed: 'Overwhelmed',
  sad: 'Sad',
  angry: 'Angry',
  numb: 'Numb',
  mixed: 'Mixed',
};

export const RecentMoodLogs: React.FC<RecentMoodLogsProps> = ({
  moodLogs,
  onViewAll,
}) => {
  if (moodLogs.length === 0) {
    return null;
  }

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (logDate.getTime() === today.getTime()) {
      return 'Today';
    }
    if (logDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    return logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent moods</Text>
        {onViewAll && moodLogs.length > 3 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.logsContainer}>
        {moodLogs.slice(0, 3).map((log, index) => (
          <Animated.View
            key={log.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.logItem, index === 0 && styles.firstLogItem]}
          >
            <View style={styles.logContent}>
              <Text style={styles.emoji}>{MOOD_EMOJI_MAP[log.mood]}</Text>
              <View style={styles.logTextContainer}>
                <Text style={styles.moodLabel}>{MOOD_LABEL_MAP[log.mood]}</Text>
                <Text style={styles.logDate}>
                  {formatDate(log.createdAt)} • {formatTime(log.createdAt)}
                </Text>
                {log.note && (
                  <Text style={styles.note} numberOfLines={1}>
                    {log.note}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  viewAllText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.medium,
  },
  logsContainer: {
    gap: theme.spacing.md,
  },
  logItem: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  firstLogItem: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  logContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  emoji: {
    fontSize: 24,
  },
  logTextContainer: {
    flex: 1,
  },
  moodLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs / 2,
  },
  logDate: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.xs,
  },
  note: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    fontStyle: 'italic',
  },
});

