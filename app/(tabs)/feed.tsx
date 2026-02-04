import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '~app/components/shared/ErrorView';
import { VentCardSkeleton } from '~app/components/shared/LoadingSkeleton';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { VentCard } from '~app/components/shared/VentCard';
import { useTheme } from '~app/contexts/ThemeContext';
import { generateMockVents, initializeDefaultRooms } from '~app/models/mockData';
import { storage } from '~app/models/storage';
import { api, Vent } from '~app/services/api';
import { roomsService } from '~app/services/rooms.service';
import { theme } from '~app/theme';
import { getDeviceId } from '~app/utils/deviceId';

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  const [vents, setVents] = useState<Vent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [roomNameMap, setRoomNameMap] = useState<Record<string, string>>({});

  const loadVents = useCallback(async () => {
    let deviceId: string = '';
    try {
      setError(null);
      setLoading(true);
      
      // Load filters once in parallel
      const [loadedDeviceId, hiddenPosts, blockedUsers] = await Promise.all([
        getDeviceId(),
        storage.getHiddenPosts(),
        storage.getBlockedUsers(),
      ]);
      
      deviceId = loadedDeviceId;
      api.setDeviceId(deviceId);
      
      if (__DEV__) {
        console.log('[Feed] Starting to load vents, deviceId:', deviceId);
      }

      // Try to fetch from API (silently fail if no backend)
      try {
        const response = await api.getVents({
          limit: 50,
        });
        if (response.vents && response.vents.length > 0) {
          // Filter out hidden posts and blocked users
          const filteredVents = response.vents.filter(vent => {
            if (hiddenPosts.includes(vent.id)) return false;
            if (blockedUsers.includes(vent.anonymousHandle || '')) return false;
            return true;
          });
          if (filteredVents.length > 0) {
            setVents(filteredVents);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      } catch (apiError: any) {
        // Silently fail - expected when no backend is running
        if (__DEV__) {
          console.log('API not available, using local storage');
        }
      }

      // Load rooms and local vents in parallel
      if (__DEV__) {
        console.log('[Feed] Loading rooms and local vents...');
      }
      const [roomResults, localVents] = await Promise.all([
        (async () => {
          await initializeDefaultRooms();
          const storageRooms = await storage.getAllRooms();
          const serviceRooms = await roomsService.getRooms();
          const allRooms = [...storageRooms, ...serviceRooms];
          const roomMap: Record<string, string> = {};
          allRooms.forEach(room => {
            roomMap[room.id] = room.name;
          });
          return roomMap;
        })(),
        storage.getPublicVents(),
      ]);
      
      if (__DEV__) {
        console.log('[Feed] Found', localVents.length, 'local vents');
      }
      setRoomNameMap(roomResults);

      // Filter out hidden posts and blocked users
      const filteredVents = localVents.filter(vent => {
        if (hiddenPosts.includes(vent.id)) return false;
        // Storage vents use anonymousHandle, not handle
        const handle = (vent as any).handle || vent.anonymousHandle || '';
        if (blockedUsers.includes(handle)) return false;
        return true;
      });

      if (__DEV__) {
        console.log('[Feed] After filtering:', filteredVents.length, 'vents');
      }

      if (filteredVents && filteredVents.length > 0) {
        // Convert storage vents to API format
        const formattedVents: Vent[] = filteredVents.map((vent) => ({
          id: vent.id,
          roomId: vent.room,
          text: vent.text,
          anonymousHandle: (vent as any).handle || vent.anonymousHandle || 'Anonymous',
          deviceId: deviceId || '',
          moodBefore: vent.moodBefore || 5,
          moodAfter: vent.moodAfter || 5,
          createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
          room: vent.room ? {
            id: vent.room,
            name: roomResults[vent.room] || 'General',
          } : undefined,
        }));
        if (__DEV__) {
          console.log('[Feed] Setting', formattedVents.length, 'formatted vents');
        }
        setVents(formattedVents);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // If no local vents, generate mock data (always, not just in dev)
      console.log('[Feed] No local vents found, generating mock data...');
      try {
        // Ensure rooms are initialized before generating mock data
        await initializeDefaultRooms();
        // Reload rooms after initialization to get updated room map
        const updatedStorageRooms = await storage.getAllRooms();
        const updatedServiceRooms = await roomsService.getRooms();
        const allUpdatedRooms = [...updatedStorageRooms, ...updatedServiceRooms];
        if (__DEV__) {
          console.log('[Feed] Rooms loaded:', allUpdatedRooms.length, 'rooms');
        }
        
        if (allUpdatedRooms.length === 0) {
          console.error('[Feed] No rooms available, cannot generate mock vents');
          setVents([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        
        const updatedRoomMap: Record<string, string> = {};
        allUpdatedRooms.forEach(room => {
          updatedRoomMap[room.id] = room.name;
        });
        setRoomNameMap(updatedRoomMap);
        
        if (__DEV__) {
          console.log('[Feed] Generating 12 mock vents...');
        }
        const mockVents = await generateMockVents(12);
        if (__DEV__) {
          console.log('[Feed] Mock vents generated:', mockVents?.length || 0, 'vents');
        }
        
        if (mockVents && mockVents.length > 0) {
          // Reload vents from storage to ensure we have the latest data
          const reloadedVents = await storage.getAllVents();
          if (__DEV__) {
            console.log('[Feed] Reloaded', reloadedVents.length, 'vents from storage');
          }
          
          // Filter out hidden posts and blocked users
          const filteredReloaded = reloadedVents.filter(vent => {
            if (hiddenPosts.includes(vent.id)) return false;
            // Storage vents use anonymousHandle, not handle
            const handle = (vent as any).handle || vent.anonymousHandle || '';
            if (blockedUsers.includes(handle)) return false;
            return true;
          });
          
          if (filteredReloaded.length > 0) {
            const formattedVents: Vent[] = filteredReloaded.map((vent) => {
              // Find room name from the vent's room ID
              const ventRoom = allUpdatedRooms.find(r => r.id === vent.room);
              return {
                id: vent.id,
                roomId: vent.room,
                text: vent.text,
                anonymousHandle: (vent as any).handle || vent.anonymousHandle || 'Anonymous',
                deviceId: deviceId || '',
                moodBefore: vent.moodBefore || 5,
                moodAfter: vent.moodAfter || 5,
                createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
                room: ventRoom ? {
                  id: ventRoom.id,
                  name: ventRoom.name,
                } : {
                  id: vent.room,
                  name: 'General',
                },
              };
            });
            if (__DEV__) {
              console.log('[Feed] Setting', formattedVents.length, 'formatted vents');
            }
            setVents(formattedVents);
            setLoading(false);
            setRefreshing(false);
            return;
          } else {
            if (__DEV__) {
              console.warn('[Feed] All reloaded vents were filtered out');
            }
          }
        } else {
          if (__DEV__) {
            console.warn('[Feed] Mock vents generation returned empty array');
          }
        }
      } catch (mockError: any) {
        console.error('[Feed] Error generating mock vents:', mockError);
        if (__DEV__) {
          console.error('[Feed] Error details:', mockError?.message, mockError?.stack);
        }
        // Fall through to show empty state if mock generation fails
      }
      
      // If we get here, show empty state
      if (__DEV__) {
        console.log('[Feed] No vents to display, showing empty state');
      }
      setVents([]);
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      if (__DEV__) {
        console.error('Error loading vents:', err);
      }
      // Try to generate mock data even on error
      try {
        // Get deviceId if not already available
        let fallbackDeviceId = deviceId;
        if (!fallbackDeviceId) {
          try {
            fallbackDeviceId = await getDeviceId();
          } catch (deviceIdError: any) {
            if (__DEV__) {
              console.error('Error getting device ID:', deviceIdError);
            }
            fallbackDeviceId = '';
          }
        }
        
        await initializeDefaultRooms();
        const fallbackStorageRooms = await storage.getAllRooms();
        const fallbackServiceRooms = await roomsService.getRooms();
        const allFallbackRooms = [...fallbackStorageRooms, ...fallbackServiceRooms];
        const fallbackRoomMap: Record<string, string> = {};
        allFallbackRooms.forEach(room => {
          fallbackRoomMap[room.id] = room.name;
        });
        setRoomNameMap(fallbackRoomMap);
        
        const mockVents = await generateMockVents(12);
        if (mockVents && mockVents.length > 0) {
          // Reload from storage to get the actual saved vents
          const reloadedFromStorage = await storage.getAllVents();
          const filteredReloaded = reloadedFromStorage.filter(vent => {
            if (hiddenPosts.includes(vent.id)) return false;
            const handle = (vent as any).handle || vent.anonymousHandle || '';
            if (blockedUsers.includes(handle)) return false;
            return true;
          });
          
          if (filteredReloaded.length > 0) {
            const formattedVents: Vent[] = filteredReloaded.map((vent) => {
              const ventRoom = allFallbackRooms.find(r => r.id === vent.room);
              return {
                id: vent.id,
                roomId: vent.room,
                text: vent.text,
                anonymousHandle: (vent as any).handle || vent.anonymousHandle || 'Anonymous',
                deviceId: fallbackDeviceId || '',
                moodBefore: vent.moodBefore || 5,
                moodAfter: vent.moodAfter || 5,
                createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
                room: ventRoom ? {
                  id: ventRoom.id,
                  name: ventRoom.name,
                } : {
                  id: vent.room,
                  name: 'General',
                },
              };
            });
            setVents(formattedVents);
          } else {
            setVents([]);
          }
        } else {
          setVents([]);
        }
      } catch (fallbackError: any) {
        console.error('Error in fallback mock generation:', fallbackError);
        setVents([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVents();
  }, [loadVents]);

  // Debug: Log when vents change
  useEffect(() => {
    if (__DEV__) {
      console.log('[Feed] Vents state changed:', vents.length, 'vents, loading:', loading, 'refreshing:', refreshing);
      if (vents.length > 0) {
        console.log('[Feed] First vent:', vents[0]?.id, vents[0]?.text?.substring(0, 50));
      }
    }
  }, [vents, loading, refreshing]);

  // Refresh when screen comes into focus (e.g., returning from vent detail)
  useFocusEffect(
    useCallback(() => {
      loadVents();
    }, [loadVents])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadVents();
  }, [loadVents]);

  const handleComposePress = () => {
    router.push('/compose');
  };

  const styles = createStyles(backgroundColor);

  // Show loading skeleton only if we're actually loading and have no vents
  if (loading && vents.length === 0) {
    console.log('[Feed] Showing loading skeleton');
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <VentCardSkeleton />
          <VentCardSkeleton />
          <VentCardSkeleton />
        </ScrollView>
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fab} onPress={handleComposePress}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error && vents.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorView message={error} onRetry={loadVents} />
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fab} onPress={handleComposePress}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const dynamicStyles = StyleSheet.create({
    scrollContent: {
      padding: theme.spacing.xl,
      paddingTop: Math.max(insets.top + theme.spacing.md, theme.spacing.lg),
      paddingBottom: 120,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {vents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyTitle}>No vents yet</Text>
            <Text style={styles.emptyText}>
              Be the first to share what's on your mind
            </Text>
            <PrimaryButton
              title="Create Your First Vent"
              onPress={handleComposePress}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          vents.map((vent, index) => {
            if (!vent || !vent.id) {
              console.warn('[Feed] Invalid vent at index', index, vent);
              return null;
            }
            return (
              <VentCard
                key={vent.id}
                vent={{
                  id: vent.id,
                  handle: vent.anonymousHandle || 'Anonymous',
                  text: vent.text || '',
                  room: vent.room?.name || roomNameMap[vent.roomId] || 'General',
                }}
              />
            );
          })
        )}
      </ScrollView>
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleComposePress}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
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
  fabContainer: {
    position: 'absolute',
    bottom: theme.spacing.xl + 60,
    right: theme.spacing['2xl'],
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
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: theme.typography.fontWeight.regular,
    lineHeight: theme.typography.fontSize['2xl'] * 1.1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
    paddingHorizontal: theme.spacing.xl,
    minHeight: 400,
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
    color: theme.colors.text.primary, // Darker
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    paddingHorizontal: theme.spacing.md,
    fontWeight: theme.typography.fontWeight.medium,
    numberOfLines: 2,
  },
  emptyButton: {
    marginTop: theme.spacing.md,
    minWidth: 200,
  },
});

