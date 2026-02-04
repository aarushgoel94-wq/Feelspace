import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { CALM_EASING, ANIMATION_DURATION } from '~app/utils/animations';
import { triggerHapticImpact } from '~app/utils/haptics';
import { ErrorView } from '~app/components/shared/ErrorView';
import { VentCardSkeleton } from '~app/components/shared/LoadingSkeleton';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { VentCard } from '~app/components/shared/VentCard';
import { initializeDefaultRooms, generateMockVents } from '~app/models/mockData';
import { storage } from '~app/models/storage';
import { api, Vent } from '~app/services/api';
import { roomsService } from '~app/services/rooms.service';
import { theme } from '~app/theme';
import { getDeviceId } from '~app/utils/deviceId';
import { getRoomMetadata } from '~app/utils/roomMetadata';
import { useTheme } from '~app/contexts/ThemeContext';

export default function RoomFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [vents, setVents] = useState<Vent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  
  // Smooth entry animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  
  useEffect(() => {
    // Gentle fade and slide in when entering room
    opacity.value = withTiming(1, {
      duration: ANIMATION_DURATION.standard,
      easing: CALM_EASING.smooth,
    });
    translateY.value = withTiming(0, {
      duration: ANIMATION_DURATION.standard,
      easing: CALM_EASING.smooth,
    });
    
    // Soft haptic feedback on room entry
    triggerHapticImpact();
  }, []);
  
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const actualRoomId = Array.isArray(roomId) ? roomId[0] : roomId;

  const loadVents = useCallback(async () => {
    if (!actualRoomId) return;

    try {
      setError(null);
      setLoading(true);
      
      // Set room name immediately (will be updated if found)
      setRoomName(actualRoomId);

      const deviceId = await getDeviceId();
      api.setDeviceId(deviceId);

      // Optimize: Load room info and vents in parallel
      const [roomInfo, apiVents] = await Promise.allSettled([
        // Get room name and info
        (async () => {
          try {
            const storageRooms = await storage.getAllRooms();
            if (storageRooms.length === 0) {
              await initializeDefaultRooms();
            }
            const serviceRooms = await roomsService.getRooms();
            const allStorageRooms = await storage.getAllRooms();
            const allRooms = [...serviceRooms, ...allStorageRooms];
            const room = allRooms.find(r => 
              r.id === actualRoomId || 
              r.name === actualRoomId || 
              r.name.toLowerCase() === actualRoomId.toLowerCase()
            );
            return room ? { name: room.name, id: room.id } : { name: actualRoomId, id: actualRoomId };
          } catch (error) {
            if (__DEV__) {
              console.error('Error loading room info:', error);
            }
            return { name: actualRoomId, id: actualRoomId };
          }
        })(),
        // Try to fetch from API
        (async () => {
          try {
            const response = await api.getVents({
              limit: 50,
              roomId: actualRoomId,
            });
            return response.vents && response.vents.length > 0 ? response.vents : null;
          } catch (apiError: any) {
            return null;
          }
        })(),
      ]);

      // Set room name from room info
      if (roomInfo.status === 'fulfilled') {
        setRoomName(roomInfo.value.name);
      }

      // If API returned vents, use them (filter hidden posts and blocked users)
      if (apiVents.status === 'fulfilled' && apiVents.value) {
        const hiddenPosts = await storage.getHiddenPosts();
        const blockedUsers = await storage.getBlockedUsers();
        const filteredVents = apiVents.value.filter(vent => {
          if (hiddenPosts.includes(vent.id)) return false;
          if (blockedUsers.includes(vent.anonymousHandle || '')) return false;
          return true;
        });
        setVents(filteredVents);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fallback: Try to get vents from local storage
      const storageRooms = await storage.getAllRooms();
      const roomInfoValue = roomInfo.status === 'fulfilled' ? roomInfo.value : { name: actualRoomId, id: actualRoomId };
      const room = storageRooms.find(r => 
        r.id === roomInfoValue.id || 
        r.name === roomInfoValue.name || 
        r.id === actualRoomId || 
        r.name === actualRoomId ||
        r.name.toLowerCase() === actualRoomId.toLowerCase()
      );

      let localVents;
      if (room) {
        const storageRoom = storageRooms.find(r => r.id === room.id || r.name === room.name);
        const roomIdToUse = storageRoom?.id || room.id;
        
        // Get vents by room ID
        localVents = await storage.getVentsByRoom(roomIdToUse);

        // If no vents found, try matching by room name as well
        if (!localVents || localVents.length === 0) {
          const allLocalVents = await storage.getPublicVents();
          localVents = allLocalVents.filter(v => {
            // Match by room ID
            if (v.room === roomIdToUse || v.room === room.id) {
              return true;
            }
            // Match by room name
            const ventRoom = storageRooms.find(r => r.id === v.room);
            if (ventRoom && (ventRoom.id === roomIdToUse || ventRoom.id === room.id || ventRoom.name === room.name)) {
              return true;
            }
            return false;
          });
        }
      } else {
        localVents = [];
      }

      if (localVents && localVents.length > 0) {
        // Filter out hidden posts and blocked users
        const hiddenPosts = await storage.getHiddenPosts();
        const blockedUsers = await storage.getBlockedUsers();
        const filteredVents = localVents.filter(vent => {
          if (hiddenPosts.includes(vent.id)) return false;
          // Storage vents use anonymousHandle, not handle
          const handle = (vent as any).handle || vent.anonymousHandle || '';
          if (blockedUsers.includes(handle)) return false;
          return true;
        });
        
        const formattedVents: Vent[] = filteredVents.map((vent) => ({
          id: vent.id,
          roomId: vent.room,
          text: vent.text,
          anonymousHandle: (vent as any).handle || vent.anonymousHandle || 'Anonymous',
          deviceId: deviceId || '',
          moodBefore: vent.moodBefore || 5,
          moodAfter: vent.moodAfter || 5,
          createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
          room: room ? {
            id: room.id,
            name: room.name,
          } : undefined,
        }));
        setVents(formattedVents);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // No vents found - check if there are any vents in storage (from main feed generation)
      // Don't generate new ones here to keep total at 12
      try {
        if (__DEV__) {
          console.log('[RoomFeed] No vents found for room, checking existing vents from storage');
        }
        
        // Reload all vents from storage (these should have been generated by main feed)
        const allReloadedVents = await storage.getPublicVents();
        
        if (allReloadedVents && allReloadedVents.length > 0) {
          // Filter vents to only include those for this room
          const roomIdToMatch = room?.id || roomInfoValue?.id || actualRoomId;
          const roomNameToMatch = room?.name || roomInfoValue?.name || actualRoomId;
          
          const filteredVents = allReloadedVents.filter(vent => {
            // Match by room ID
            if (vent.room === roomIdToMatch) {
              return true;
            }
            // Match by room name
            if (vent.room === roomNameToMatch) {
              return true;
            }
            // Match by finding the room object
            const ventRoom = storageRooms.find(r => r.id === vent.room);
            if (ventRoom) {
              // Match by room ID or name
              if (ventRoom.id === roomIdToMatch || ventRoom.id === room?.id) {
                return true;
              }
              if (ventRoom.name === roomNameToMatch || ventRoom.name === room?.name) {
                return true;
              }
            }
            return false;
          });
          
          if (__DEV__) {
            console.log('[RoomFeed] Found', allReloadedVents.length, 'total vents in storage,', filteredVents.length, 'match the room');
          }
          
          if (filteredVents.length > 0) {
            // Filter out hidden posts and blocked users
            const hiddenPosts = await storage.getHiddenPosts();
            const blockedUsers = await storage.getBlockedUsers();
            const finalFiltered = filteredVents.filter(vent => {
              if (hiddenPosts.includes(vent.id)) return false;
              const handle = (vent as any).handle || vent.anonymousHandle || '';
              if (blockedUsers.includes(handle)) return false;
              return true;
            });
            
            const formattedVents: Vent[] = finalFiltered.map((vent) => {
              // Find the actual room for this vent
              const ventRoom = storageRooms.find(r => r.id === vent.room || r.name === vent.room);
              return {
                id: vent.id,
                roomId: ventRoom?.id || vent.room,
                text: vent.text,
                anonymousHandle: (vent as any).handle || vent.anonymousHandle || 'Anonymous',
                deviceId: deviceId || '',
                moodBefore: vent.moodBefore || 5,
                moodAfter: vent.moodAfter || 5,
                createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
                room: ventRoom ? {
                  id: ventRoom.id,
                  name: ventRoom.name,
                } : room ? {
                  id: room.id,
                  name: room.name,
                } : roomInfoValue ? {
                  id: roomInfoValue.id,
                  name: roomInfoValue.name,
                } : undefined,
              };
            });
            setVents(formattedVents);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
        
        // If no vents found in storage, show empty state
        if (__DEV__) {
          console.log('[RoomFeed] No vents found in storage for this room');
        }
        setVents([]);
      } catch (error: any) {
        console.error('[RoomFeed] Error loading vents from storage:', error);
        if (__DEV__) {
          console.error('[RoomFeed] Error details:', error?.message, error?.stack);
        }
        setVents([]);
      }
    } catch (err: any) {
      if (__DEV__) {
        console.error('Error loading vents:', err);
      }
      setVents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actualRoomId]);

  useEffect(() => {
    if (actualRoomId) {
      loadVents();
    }
  }, [actualRoomId, loadVents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadVents();
  }, [loadVents]);

  const handleComposePress = () => {
    router.push('/compose');
  };

  // Loading state handled in main render - smooth transition

  if (error && vents.length === 0) {
    const errorStyles = createStyles(backgroundColor);
    return (
      <View style={errorStyles.container}>
        <View style={[errorStyles.header, { paddingTop: Math.max(insets.top + theme.spacing.lg, theme.spacing.xl) }]}>
          <TouchableOpacity onPress={() => router.back()} style={errorStyles.backButton}>
            <Text style={errorStyles.backButtonText}>←</Text>
          </TouchableOpacity>
        </View>
        <ErrorView message={error} onRetry={loadVents} />
      </View>
    );
  }

  const roomMetadata = roomName ? getRoomMetadata(roomName) : null;
  const styles = createStyles(backgroundColor);

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Clear header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + theme.spacing.lg, theme.spacing.xl) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{roomName || 'Room'}</Text>
          <Text style={styles.headerSubtitle}>What people are sharing</Text>
        </View>
      </View>

      {/* Subtle divider */}
      <View style={styles.divider} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + theme.spacing['3xl'], 120) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="normal"
      >
        {loading && vents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <VentCardSkeleton />
            <VentCardSkeleton />
            <VentCardSkeleton />
          </View>
        ) : vents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyTitle}>No vents yet</Text>
            <Text style={styles.emptyText}>
              Be the first to share in this space
            </Text>
            <PrimaryButton
              title={`Share in ${roomName || 'Room'}`}
              onPress={handleComposePress}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          vents.map((vent, index) => (
            <Animated.View
              key={vent.id}
              entering={FadeInDown.delay(index * 50).duration(ANIMATION_DURATION.standard)}
            >
              <VentCard
                vent={{
                  id: vent.id,
                  handle: vent.anonymousHandle,
                  text: vent.text,
                  room: vent.room?.name || roomName || 'General',
                }}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Floating action button - calm, not aggressive */}
      <View style={[styles.fabContainer, { bottom: Math.max(insets.bottom + theme.spacing.xl, theme.spacing['2xl']) }]}>
        <TouchableOpacity 
          style={styles.fab} 
          onPress={handleComposePress}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const createStyles = (backgroundColor: string) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgroundColor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    backgroundColor: backgroundColor,
  },
  backButton: {
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    minWidth: 44, // Large touch target
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: theme.typography.fontSize['2xl'], // Larger, more intentional
    fontWeight: theme.typography.fontWeight.regular, // Not bold
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
    lineHeight: theme.typography.fontSize['2xl'] * theme.typography.lineHeight.normal,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.base, // Calm subheading
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  divider: {
    height: 0.5,
    backgroundColor: theme.colors.border.light,
    opacity: 0.15,
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  loadingContainer: {
    gap: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.xl,
    minHeight: 400,
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
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyButton: {
    marginTop: theme.spacing.md,
    minWidth: 200,
  },
  fabContainer: {
    position: 'absolute',
    right: theme.spacing.xl,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  fabText: {
    fontSize: 28,
    color: theme.colors.text.inverse,
    fontWeight: '300',
    lineHeight: 32,
  },
});

