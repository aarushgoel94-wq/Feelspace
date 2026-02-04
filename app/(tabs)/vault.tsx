import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { Vent } from '~app/models/types';
import { VentCard } from '~app/components/shared/VentCard';
import { roomsService } from '~app/services/rooms.service';
import { useTheme } from '~app/contexts/ThemeContext';
import { api } from '~app/services/api';
import { getDeviceId } from '~app/utils/deviceId';
import { sessionManager } from '~app/models/session';
import { triggerHapticImpact } from '~app/utils/haptics';

type DraftVent = Vent & { isDraft?: boolean };

export default function VaultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  const [drafts, setDrafts] = useState<DraftVent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const draftVents = await storage.getDrafts();
      
      // Convert room IDs to room names
      const serviceRooms = await roomsService.getRooms();
      const storageRooms = await storage.getAllRooms();
      const allRooms = [...serviceRooms, ...storageRooms];
      
      // Create a map of room IDs to names
      const roomNameMap: Record<string, string> = {};
      allRooms.forEach(room => {
        roomNameMap[room.id] = room.name;
        roomNameMap[room.name] = room.name;
      });
      
      // Convert vents to have room names instead of IDs
      const draftsWithRoomNames = draftVents.map(vent => ({
        ...vent,
        room: roomNameMap[vent.room] || vent.room || 'General',
      }));
      
      setDrafts(draftsWithRoomNames);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading drafts:', error);
      }
      setDrafts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDrafts();
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const formatDate = (date: Date | string): string => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
  };

  const handlePublishDraft = async (draftId: string) => {
    try {
      setPublishingId(draftId);
      triggerHapticImpact();
      
      // Get the draft
      const draft = await storage.getVent(draftId);
      if (!draft || !draft.isDraft) {
        Alert.alert('Error', 'Draft not found.');
        return;
      }

      // Publish the draft (remove isDraft flag)
      await storage.publishDraft(draftId);

      // Try to sync with backend if online
      try {
        const deviceId = await getDeviceId();
        const anonymousHandle = sessionManager.getAnonymousHandle();
        
        // Get room ID
        const serviceRooms = await roomsService.getRooms();
        const storageRooms = await storage.getAllRooms();
        const allRooms = [...serviceRooms, ...storageRooms];
        const room = allRooms.find(r => r.id === draft.room || r.name === draft.room);
        const roomId = room?.id || draft.room;

        try {
          const { offlineSync } = await import('~app/services/offlineSync');
          const isOnline = offlineSync.getIsOnline();
          
          if (isOnline) {
            try {
              await api.createVent({
                ...(roomId && { roomId }),
                text: draft.text,
                anonymousHandle,
                deviceId,
                moodBefore: draft.moodBefore || 5,
                moodAfter: draft.moodAfter || 5,
                generateReflection: true,
              });
            } catch (apiError) {
              // Queue for sync later if API fails
              await offlineSync.queueAction('vent', 'create', {
                id: draftId,
                roomId,
                text: draft.text,
                anonymousHandle,
                deviceId,
                moodBefore: draft.moodBefore || 5,
                moodAfter: draft.moodAfter || 5,
              });
            }
          } else {
            // Queue for sync when online
            await offlineSync.queueAction('vent', 'create', {
              id: draftId,
              roomId,
              text: draft.text,
              anonymousHandle,
              deviceId,
              moodBefore: draft.moodBefore || 5,
              moodAfter: draft.moodAfter || 5,
            });
          }
        } catch (syncError) {
          // Silently fail - vent is published locally
        }
      } catch (error) {
        // Silently fail - vent is published locally
      }

      // Reload drafts to reflect the change
      await loadDrafts();
      
      Alert.alert('Published', 'Your vent has been published to the community.');
    } catch (error) {
      Alert.alert('Error', 'Failed to publish draft. Please try again.');
    } finally {
      setPublishingId(null);
    }
  };

  const styles = createStyles(backgroundColor);

  const dynamicStyles = StyleSheet.create({
    scrollContent: {
      padding: theme.spacing.xl,
      paddingTop: Math.max(insets.top + theme.spacing.md, theme.spacing.lg),
      paddingBottom: theme.spacing.xl,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="normal"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Vault</Text>
          <Text style={styles.subtitle}>
            Your draft vents and emotional insights
          </Text>
        </View>

        {/* AI Reflections Button */}
        <View style={styles.aiReflectionsButtonContainer}>
          <TouchableOpacity
            style={styles.aiReflectionsButton}
            onPress={() => router.push('/ai-reflections')}
            activeOpacity={0.8}
          >
            <View style={styles.aiReflectionsButtonContent}>
              <Text style={styles.aiReflectionsButtonIcon}>✨</Text>
              <Text style={styles.aiReflectionsButtonText}>View AI Reflections</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Drafts Section */}
        <View style={styles.draftsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Drafts</Text>
            <Text style={styles.sectionSubtitle}>
              {drafts.length === 0
                ? 'Draft vents will appear here'
                : `${drafts.length} draft${drafts.length !== 1 ? 's' : ''}`}
            </Text>
          </View>

          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : drafts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyTitle}>No drafts yet</Text>
              <Text style={styles.emptyText}>
                Save vents as drafts when composing to keep them private
              </Text>
            </View>
          ) : (
            <View style={styles.ventsList}>
              {drafts.map((vent, index) => {
                const isPublishing = publishingId === vent.id;

                return (
                  <Animated.View
                    key={vent.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                    style={styles.ventWrapper}
                  >
                    <VentCard
                      vent={{
                        id: vent.id,
                        handle: vent.anonymousHandle,
                        text: vent.text,
                        room: vent.room,
                      }}
                    />
                    <View style={styles.draftActions}>
                      <View style={styles.draftDateContainer}>
                        <Text style={styles.draftDateLabel}>Created</Text>
                        <Text style={styles.draftDate}>
                          {formatDate(vent.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.draftButtons}>
                        <TouchableOpacity
                          style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]}
                          onPress={() => handlePublishDraft(vent.id)}
                          activeOpacity={0.7}
                          disabled={isPublishing}
                        >
                          <Text style={styles.publishButtonText}>
                            {isPublishing ? 'Publishing...' : '📤 Publish'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>
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
  header: {
    marginBottom: theme.spacing.lg,
  },
  aiReflectionsButtonContainer: {
    marginBottom: theme.spacing.lg,
  },
  aiReflectionsButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  aiReflectionsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  aiReflectionsButtonIcon: {
    fontSize: 20,
  },
  aiReflectionsButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  draftsSection: {
    marginTop: theme.spacing.xl,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  title: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.fontSize['4xl'] * theme.typography.lineHeight.tight,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.lg, // Larger
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
  },
  ventsList: {
    gap: theme.spacing.md,
  },
  ventWrapper: {
    position: 'relative',
  },
  draftActions: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  draftDateContainer: {
    flex: 1,
  },
  draftDateLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.xs / 2,
  },
  draftDate: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
  },
  draftButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  publishButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary.main,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['4xl'],
    minHeight: 300,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    paddingHorizontal: theme.spacing.md,
  },
});
