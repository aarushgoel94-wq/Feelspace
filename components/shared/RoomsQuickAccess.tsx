import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { useRouter } from 'expo-router';
import { roomsService } from '~app/services/rooms.service';
import { storage } from '~app/models/storage';
import { initializeDefaultRooms } from '~app/models/mockData';
import { triggerHapticImpact } from '~app/utils/haptics';

interface Room {
  id: string;
  name: string;
}

// Predefined room list with order - matching user requirements
const QUICK_ACCESS_ROOMS = [
  'Work',
  'Relationships',
  'Family',
  'Daily Annoyances',
  'Studies',
  'Money',
  'Health Feelings',
  'Society',
];

// Room emoji mapping
const getRoomEmoji = (roomName: string): string => {
  const emojiMap: Record<string, string> = {
    'Work': '💼',
    'Work Frustrations': '💼',
    'Relationships': '💕',
    'Family': '👨‍👩‍👧‍👦',
    'Family Matters': '👨‍👩‍👧‍👦',
    'Daily Annoyances': '😤',
    'Studies': '📚',
    'Money': '💰',
    'Health Feelings': '🏥',
    'Society': '🌍',
    'Anxiety & Worry': '😰',
    'Stress Relief': '🧘',
    'Loneliness': '🌙',
    'Grief & Loss': '🕯️',
    'Anger': '🔥',
  };
  
  // Try exact match first
  if (emojiMap[roomName]) {
    return emojiMap[roomName];
  }
  
  // Try partial match
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (roomName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(roomName.toLowerCase())) {
      return emoji;
    }
  }
  
  return '💭';
};

export const RoomsQuickAccess: React.FC = () => {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    try {
      // Initialize default rooms if needed
      const storageRooms = await storage.getAllRooms();
      if (storageRooms.length === 0) {
        await initializeDefaultRooms();
      }

      // Get all rooms
      const serviceRooms = await roomsService.getRooms();
      const allStorageRooms = await storage.getAllRooms();
      const allRooms = [...serviceRooms, ...allStorageRooms];
      
      // Create flexible room matching (handle variations like "Work Frustrations" -> "Work")
      const roomNameVariations: Record<string, string[]> = {
        'Work': ['Work', 'Work Frustrations'],
        'Relationships': ['Relationships'],
        'Family': ['Family', 'Family Matters'],
        'Daily Annoyances': ['Daily Annoyances', 'Stress Relief'],
        'Studies': ['Studies'],
        'Money': ['Money'],
        'Health Feelings': ['Health Feelings', 'Health'],
        'Society': ['Society'],
      };

      // Filter and order rooms based on QUICK_ACCESS_ROOMS list
      const orderedRooms: Room[] = [];
      const usedRooms = new Set<string>();

      QUICK_ACCESS_ROOMS.forEach(roomName => {
        // Try to find matching room (exact match or variation)
        const variations = roomNameVariations[roomName] || [roomName];
        let found: Room | undefined;

        for (const variation of variations) {
          found = allRooms.find(r => {
            const roomKey = r.id || r.name;
            if (usedRooms.has(roomKey)) return false;
            return r.name === variation || 
                   r.name.toLowerCase() === variation.toLowerCase() ||
                   r.name.toLowerCase().includes(variation.toLowerCase()) ||
                   variation.toLowerCase().includes(r.name.toLowerCase());
          });
          if (found) break;
        }

        if (found) {
          const roomKey = found.id || found.name;
          usedRooms.add(roomKey);
          orderedRooms.push(found);
        } else {
          // If not found, create a placeholder room object for navigation
          orderedRooms.push({
            id: roomName.toLowerCase().replace(/\s+/g, '-'),
            name: roomName,
          });
        }
      });

      setRooms(orderedRooms);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading rooms:', error);
      }
      // Fallback to default room objects
      setRooms(QUICK_ACCESS_ROOMS.map(name => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleRoomPress = (room: Room) => {
    // Soft haptic feedback
    triggerHapticImpact();

    const roomId = room.id || room.name;
    router.push(`/room/${encodeURIComponent(roomId)}`);
  };

  if (loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} allowFontScaling maxFontSizeMultiplier={1.3}>
          Rooms
        </Text>
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/explore')}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAllText} allowFontScaling maxFontSizeMultiplier={1.3}>
            View All →
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {rooms.map((room, index) => (
          <Animated.View
            key={room.id || room.name}
            entering={FadeInDown.delay(index * 50).duration(300)}
            style={styles.roomCardWrapper}
          >
            <TouchableOpacity
              onPress={() => handleRoomPress(room)}
              activeOpacity={0.8}
              style={styles.roomCardTouchable}
            >
              <Card variant="elevated" style={styles.roomCard}>
                <View style={styles.roomContent}>
                  <Text style={styles.roomEmoji}>{getRoomEmoji(room.name)}</Text>
                  <Text style={styles.roomName} allowFontScaling maxFontSizeMultiplier={1.3}>
                    {room.name}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize['2xl'], // Large welcoming header
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: theme.typography.fontSize['2xl'] * theme.typography.lineHeight.normal,
  },
  viewAllButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  viewAllText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.medium,
  },
  scrollView: {
    marginHorizontal: -theme.spacing.xl, // Extend scroll area to screen edges
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  roomCardWrapper: {
    width: 140,
    marginRight: 0,
  },
  roomCardTouchable: {
    width: '100%',
  },
  roomCard: {
    padding: 0,
    overflow: 'hidden',
    width: 150, // Slightly wider
    minHeight: 140, // Taller - larger touch target
  },
  roomContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'], // Premium padding
    paddingHorizontal: theme.spacing.lg, // More horizontal space
  },
  roomEmoji: {
    fontSize: 44, // Larger emoji
    marginBottom: theme.spacing.md, // More spacing
  },
  roomName: {
    fontSize: theme.typography.fontSize.lg, // Calm subheading
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
  },
});
