import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { api } from '~app/services/api';
import { useTheme } from '~app/contexts/ThemeContext';
import { getDeviceId } from '~app/utils/deviceId';

interface Report {
  id: string;
  ventId: string;
  handle?: string;
  reason: string;
  description?: string;
  createdAt: string;
}

// Developer identification - check if user is developer
// Developer mode is enabled if:
// 1. EXPO_PUBLIC_DEVELOPER_DEVICE_ID environment variable matches current device ID, OR
// 2. Running in development mode (__DEV__)
const isDeveloper = async (): Promise<boolean> => {
  try {
    // In development mode, always allow developer features
    if (__DEV__) {
      return true;
    }
    
    // Check if device ID matches developer ID from environment variable
    const developerDeviceId = process.env.EXPO_PUBLIC_DEVELOPER_DEVICE_ID;
    if (!developerDeviceId) {
      return false;
    }
    
    const deviceId = await getDeviceId();
    return deviceId === developerDeviceId;
  } catch {
    return false;
  }
};

export default function ReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDev, setIsDev] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try API first
      try {
        const apiReports = await api.getReports?.();
        if (apiReports && apiReports.length > 0) {
          setReports(apiReports);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      } catch (apiError) {
        // Silently fallback to local storage
      }

      // Fallback to local storage
      const localReports = await storage.getReports();
      const formattedReports: Report[] = localReports.map(r => ({
        id: r.id,
        ventId: r.ventId,
        handle: r.handle,
        reason: r.reason,
        description: r.description,
        createdAt: r.createdAt,
      }));
      setReports(formattedReports);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading reports:', error);
      }
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Check if user is developer
    isDeveloper().then(setIsDev);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports();
  }, [loadReports]);

  const handleReportMenu = (report: Report) => {
    const options = isDev 
      ? [
          'View Vent',
          'Delete Report',
          'Delete Vent (Developer Only)',
          'Cancel',
        ]
      : [
          'View Vent',
          'Delete Report',
          'Cancel',
        ];
    const cancelButtonIndex = isDev ? 3 : 2;
    const destructiveIndices = isDev ? [1, 2] : [1];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex: destructiveIndices,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            router.push(`/vent/${report.ventId}`);
          } else if (buttonIndex === 1) {
            handleDeleteReport(report);
          } else if (buttonIndex === 2 && isDev) {
            handleDeleteVent(report);
          }
        }
      );
    } else {
      const buttons = [
        { text: 'View Vent', onPress: () => router.push(`/vent/${report.ventId}`) },
        { text: 'Delete Report', onPress: () => handleDeleteReport(report), style: 'destructive' as const },
      ];
      if (isDev) {
        buttons.push({ text: 'Delete Vent (Developer Only)', onPress: () => handleDeleteVent(report), style: 'destructive' as const });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' as const });
      
      Alert.alert(
        'Report Options',
        undefined,
        buttons
      );
    }
  };

  const handleDeleteVent = async (report: Report) => {
    if (!isDev) {
      Alert.alert('Error', 'This action is only available to developers.');
      return;
    }

    Alert.alert(
      'Delete Vent',
      'Are you sure you want to permanently delete this vent? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Try to delete from backend API first
              try {
                const deviceId = await getDeviceId();
                await api.deleteVent(report.ventId, deviceId);
              } catch (apiError) {
                // Continue with local deletion even if API fails
                if (__DEV__) {
                  console.warn('Failed to delete vent from API:', apiError);
                }
              }
              
              // Delete from local storage
              await storage.deleteVent(report.ventId);
              
              // Delete associated comments, reactions, and reflections
              try {
                const comments = await storage.getCommentsByVent(report.ventId);
                for (const comment of comments) {
                  await storage.deleteComment(comment.id);
                }
                
                const reactions = await storage.getReactionsByVent(report.ventId);
                for (const reaction of reactions) {
                  await storage.deleteReaction(reaction.id);
                }
                
                await storage.deleteReflection(report.ventId);
              } catch (error) {
                if (__DEV__) {
                  console.warn('Error deleting associated data:', error);
                }
              }
              
              // Also delete the report since vent is gone
              await storage.deleteReport(report.id);
              
              // Reload reports
              await loadReports();
              
              Alert.alert('Success', 'Vent has been permanently deleted.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete vent. Please try again.');
              if (__DEV__) {
                console.error('Error deleting vent:', error);
              }
            }
          },
        },
      ]
    );
  };

  const handleDeleteReport = async (report: Report) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Try API first
              try {
                await api.deleteReport?.(report.id);
              } catch (apiError) {
                // Fallback to local storage
              }
              
              // Remove from local storage
              await storage.deleteReport(report.id);
              
              // Reload reports
              await loadReports();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete report. Please try again.');
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(backgroundColor);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + theme.spacing.md, theme.spacing.lg) }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + theme.spacing['3xl'], theme.spacing['2xl']) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary.main}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>
            {reports.length === 0 
              ? 'No reports yet' 
              : `${reports.length} report${reports.length === 1 ? '' : 's'}`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading reports...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No Reports</Text>
            <Text style={styles.emptyText}>
              Reports from users will appear here for review.
            </Text>
          </View>
        ) : (
          reports.map((report, index) => (
            <Animated.View
              key={report.id}
              entering={FadeInDown.delay(index * 50)}
              style={styles.reportWrapper}
            >
              <Card variant="elevated" style={styles.reportCard}>
                <TouchableOpacity
                  onPress={() => handleReportMenu(report)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportHeader}>
                    <View style={styles.reportHeaderLeft}>
                      <Text style={styles.reportReason}>{report.reason}</Text>
                      <Text style={styles.reportDate}>
                        {new Date(report.createdAt).toLocaleDateString()} at{' '}
                        {new Date(report.createdAt).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={styles.menuIcon}>⋯</Text>
                  </View>
                  
                  {report.handle && (
                    <Text style={styles.reportHandle}>User: {report.handle}</Text>
                  )}
                  
                  {report.description && (
                    <Text style={styles.reportDescription} numberOfLines={3}>
                      {report.description}
                    </Text>
                  )}
                  
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={styles.viewVentButton}
                      onPress={() => router.push(`/vent/${report.ventId}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.viewVentButtonText}>View Vent</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.reportVentId}>Vent ID: {report.ventId.substring(0, 20)}...</Text>
                </TouchableOpacity>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (backgroundColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgroundColor,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
    minHeight: 300,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  reportWrapper: {
    marginBottom: theme.spacing.md,
  },
  reportCard: {
    padding: theme.spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  reportHeaderLeft: {
    flex: 1,
  },
  reportReason: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.xs,
  },
  reportDate: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.xs * theme.typography.lineHeight.normal,
  },
  menuIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reportHandle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
  },
  reportDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: theme.typography.fontWeight.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.sm,
  },
  reportVentId: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: 'monospace',
    marginTop: theme.spacing.sm,
  },
  reportActions: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  viewVentButton: {
    backgroundColor: theme.colors.primary.main,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  viewVentButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

