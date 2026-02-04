import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { Room } from '~app/services/api';
import { roomsService } from '~app/services/rooms.service';
import { theme } from '~app/theme';
import { useTheme } from '~app/contexts/ThemeContext';
import { getRoomMetadata } from '~app/utils/roomMetadata';
import { triggerHapticImpact } from '~app/utils/haptics';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { backgroundColor } = useTheme();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const fetchedRooms = await roomsService.getRooms();
      setRooms(fetchedRooms);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading rooms:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Refresh rooms when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
  };

  const handleRoomPress = (room: Room) => {
    try {
      // Intentional tap - smooth haptic feedback
      triggerHapticImpact();
      
      // Smooth transition - maintain emotional tone
      const roomIdToUse = room.id || room.name || '';
      if (roomIdToUse) {
        router.push(`/room/${encodeURIComponent(roomIdToUse)}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error navigating to room:', error);
      }
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
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Rooms</Text>
          <Text style={styles.subtitle}>
            Find a space that feels right for you
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading rooms...</Text>
          </View>
        ) : rooms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏠</Text>
            <Text style={styles.emptyText}>No rooms available</Text>
          </View>
        ) : (
          <View style={styles.roomsList}>
            {rooms.map((room, index) => {
              const metadata = getRoomMetadata(room.name);
              return (
                <Animated.View
                  key={room.id}
                  entering={FadeInDown.delay(index * 60).duration(400)}
                  style={styles.roomCardWrapper}
                >
                  <TouchableOpacity
                    style={styles.roomCard}
                    onPress={() => handleRoomPress(room)}
                    activeOpacity={0.6} // Softer interaction
                  >
                    <Card variant="elevated" style={[styles.card, { borderLeftColor: metadata.color, borderLeftWidth: 4 }]}>
                      <View style={styles.roomContent}>
                        <View style={[styles.symbolContainer, { backgroundColor: metadata.color }]}>
                          <Text style={styles.roomSymbol}>{metadata.symbol}</Text>
                        </View>
                        <View style={styles.roomInfo}>
                          <Text style={styles.roomName}>{metadata.name}</Text>
                          <Text style={styles.roomDescription}>
                            {metadata.description}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
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
  header: {
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border.light,
    opacity: 0.2,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: -0.5,
    lineHeight: theme.typography.fontSize['3xl'] * theme.typography.lineHeight.normal,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.lg, // Larger
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
    paddingRight: theme.spacing.lg, // More padding
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  emptyContainer: {
    padding: theme.spacing['4xl'],
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  roomsList: {
    gap: theme.spacing.md,
  },
  roomCardWrapper: {
    marginBottom: 0, // Gap handles spacing
  },
  roomCard: {
    width: '100%',
  },
  card: {
    padding: theme.spacing.lg,
    minHeight: 88,
    borderLeftWidth: 3,
  },
  roomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  symbolContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomSymbol: {
    fontSize: 24,
    color: theme.colors.text.primary,
    opacity: 0.6,
  },
  roomInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  roomName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs / 2,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.normal,
  },
  roomDescription: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
    fontStyle: 'italic',
  },
});