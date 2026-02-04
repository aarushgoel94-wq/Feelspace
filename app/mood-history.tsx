import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '~app/models/storage';
import { MoodLog } from '~app/models/types';
import { api } from '~app/services/api';
import { theme } from '~app/theme';
import { getDeviceId } from '~app/utils/deviceId';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';
import { AnimatedMoodTimeline } from '~app/components/shared/AnimatedMoodTimeline';

export default function MoodHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<MoodLog | null>(null);

  useEffect(() => {
    loadMoodLogs();
  }, []);

  const loadMoodLogs = async () => {
    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        // If no device ID, just load from local storage
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        const logs = await storage.getMoodLogsByDateRange(startDateStr, endDateStr);
        const sortedLogs = logs.sort((a: MoodLog, b: MoodLog) => a.date.localeCompare(b.date));
        setMoodLogs(sortedLogs);
        return;
      }

      // Load historical data - get all available logs
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Try to load from backend first
      try {
        const backendLogs = await api.getMoodLogs({
          deviceId,
          startDate: startDateStr,
          endDate: endDateStr,
        });

        // Convert backend format to local format and sync to storage
        const localLogs: MoodLog[] = [];
        for (const backendLog of backendLogs) {
          try {
            // Check if already exists in local storage
            const existing = await storage.getMoodLogByDate(backendLog.date);
            if (existing) {
              // Update if needed
              await storage.updateMoodLog(existing.id, {
                moodLevel: backendLog.moodLevel,
                note: backendLog.note || undefined,
              });
              localLogs.push({
                ...existing,
                moodLevel: backendLog.moodLevel,
                note: backendLog.note || undefined,
              });
            } else {
              // Create new in local storage
              const created = await storage.createMoodLog({
                date: backendLog.date,
                moodLevel: backendLog.moodLevel,
                note: backendLog.note || undefined,
              });
              localLogs.push(created);
            }
          } catch (logError) {
            // Skip this log if there's an error, continue with others
            if (__DEV__) {
              console.warn('Error processing mood log:', logError);
            }
          }
        }

        // Sort by date (oldest first)
        const sortedLogs = localLogs.sort((a: MoodLog, b: MoodLog) => a.date.localeCompare(b.date));
        setMoodLogs(sortedLogs);
      } catch (apiError) {
        // Fallback to local storage if backend fails
        try {
          const logs = await storage.getMoodLogsByDateRange(startDateStr, endDateStr);
          // Sort by date (oldest first)
          const sortedLogs = logs.sort((a: MoodLog, b: MoodLog) => a.date.localeCompare(b.date));
          setMoodLogs(sortedLogs);
        } catch (storageError) {
          // If local storage also fails, set empty array
          if (__DEV__) {
            console.error('Error loading mood logs from storage:', storageError);
          }
          setMoodLogs([]);
        }
      }
    } catch (error) {
      // Silently handle all errors - don't show error messages
      if (__DEV__) {
        console.error('Error loading mood logs:', error);
      }
      // Set empty array on any error
      setMoodLogs([]);
    }
  };

  const handlePointPress = React.useCallback((log: MoodLog) => {
    try {
      // Safely update selected log - prevent crashes from invalid data
      if (log && log.date && log.moodLevel) {
        setSelectedLog(log);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error in handlePointPress:', error);
      }
    }
  }, []);

  const hasData = moodLogs.length > 0;

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + theme.spacing.sm, theme.spacing.md) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mood History</Text>
          <Text style={styles.headerSubtitle}>
            {hasData 
              ? `${moodLogs.length} day${moodLogs.length !== 1 ? 's' : ''} tracked`
              : 'No data yet'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + theme.spacing['3xl'], theme.spacing['2xl']) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Timeline - with proper margins to prevent clipping */}
        <View style={styles.chartWrapper}>
          <AnimatedMoodTimeline
            moodLogs={moodLogs}
            onPointPress={handlePointPress}
            selectedDate={selectedLog?.date}
          />
        </View>

        {/* Selected Mood Details - only show note if exists, mood is shown in chart component */}
        {selectedLog && selectedLog.note && (
          <View style={styles.selectedMoodCard}>
            <Text style={styles.selectedMoodLabel}>Note</Text>
            <Text style={styles.noteText}>{selectedLog.note}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
    ...theme.shadows.small,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  backButtonText: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.bold,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.xs / 2,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md, // Horizontal padding for margins
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  chartWrapper: {
    marginVertical: theme.spacing.sm, // Vertical margins for chart
  },
  selectedMoodCard: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.small,
  },
  selectedMoodLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.xs,
  },
  selectedMoodValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.xs,
  },
  selectedMoodDate: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.md,
  },
  noteContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  noteLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
  },
  noteText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
});

