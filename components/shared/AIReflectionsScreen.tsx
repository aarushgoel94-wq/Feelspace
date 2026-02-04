import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { VentCard } from '~app/components/shared/VentCard';
import { theme } from '~app/theme';
import { api, Vent } from '~app/services/api';
import { storage } from '~app/models/storage';
import { getDeviceId } from '~app/utils/deviceId';
import { roomsService } from '~app/services/rooms.service';

interface VentWithReflection extends Vent {
  reflection?: string | null;
}

interface AIReflectionsScreenProps {
  onClose?: () => void;
}

export const AIReflectionsScreen: React.FC<AIReflectionsScreenProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [ventsWithReflections, setVentsWithReflections] = useState<VentWithReflection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVentsWithReflections();
  }, []);

  const loadVentsWithReflections = async () => {
    try {
      setLoading(true);
      const deviceId = await getDeviceId();
      
      // Get rooms for mapping
      const serviceRooms = await roomsService.getRooms();
      const storageRooms = await storage.getAllRooms();
      const allRooms = [...serviceRooms, ...storageRooms];
      const roomNameMap: Record<string, string> = {};
      allRooms.forEach(room => {
        roomNameMap[room.id] = room.name;
        roomNameMap[room.name] = room.name;
      });
      
      // Try API first
      try {
        const response = await api.getVents();
        const ventsArray = response.vents || [];
        
        const reflectionsFromApi = ventsArray.filter((v: VentWithReflection) => 
          v.reflection && v.reflection.trim().length > 0
        );
        
        // Map room IDs to room names
        const ventsWithRoomNames = reflectionsFromApi.map(vent => ({
          ...vent,
          room: vent.room || (vent.roomId && roomNameMap[vent.roomId] ? {
            id: vent.roomId,
            name: roomNameMap[vent.roomId],
          } : { id: '', name: 'General' }),
        }));
        
        ventsWithRoomNames.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setVentsWithReflections(ventsWithRoomNames);
        } catch (apiError) {
        // Fallback to local storage (includes drafts)
        try {
          const localVents = await storage.getAllVents(); // Includes drafts
          const localReflectionsMap = await storage.getAllReflections();

          const ventsWithLocalReflections = localVents
            .map(vent => ({
              ...vent,
              reflection: localReflectionsMap[vent.id] || null,
            }))
            .filter(vent => vent.reflection && vent.reflection.trim().length > 0);
          
          ventsWithLocalReflections.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
          });

          setVentsWithReflections(ventsWithLocalReflections.map(vent => {
            const roomId = typeof vent.room === 'string' ? vent.room : vent.room?.id || '';
            const roomName = roomNameMap[roomId] || (typeof vent.room === 'string' ? vent.room : vent.room?.name) || 'General';
            
            return {
              id: vent.id,
              roomId: roomId,
              room: { id: roomId, name: roomName },
              text: vent.text,
              anonymousHandle: vent.anonymousHandle,
              deviceId: '',
              moodBefore: vent.moodBefore || 5,
              moodAfter: vent.moodAfter || 5,
              createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
              reflection: vent.reflection || null,
            };
          }) as VentWithReflection[]);
        } catch (storageError) {
          if (__DEV__) {
            console.error('Error loading local vents with reflections:', storageError);
          }
          setVentsWithReflections([]);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading vents with reflections:', error);
      }
      setVentsWithReflections([]);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xl,
      paddingTop: Math.max(insets.top + theme.spacing.md, theme.spacing.lg),
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.bold,
      marginBottom: theme.spacing.xs,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.text.secondary,
      fontFamily: theme.typography.fontFamily.regular,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.small,
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.colors.text.primary,
      fontWeight: '600',
    },
    scrollContent: {
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing['3xl'],
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['4xl'],
      minHeight: 400,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: theme.spacing.lg,
      opacity: 0.6,
    },
    emptyTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.semibold,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.text.secondary,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: 'center',
      lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
      paddingHorizontal: theme.spacing.xl,
    },
    loadingText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.text.secondary,
      fontFamily: theme.typography.fontFamily.regular,
      textAlign: 'center',
      marginTop: theme.spacing.xl,
    },
    ventWrapper: {
      marginBottom: theme.spacing.lg,
    },
    reflectionCard: {
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    reflectionContainer: {
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.primary.subtle,
      borderRadius: theme.borderRadius.lg,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary.main,
    },
    reflectionLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text.secondary,
      fontFamily: theme.typography.fontFamily.medium,
      marginBottom: theme.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    reflectionText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.regular,
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.regular,
      lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>AI Reflections</Text>
          <Text style={styles.headerSubtitle}>
            Reflect on your past posts with AI insights
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.loadingText}>Loading reflections...</Text>
          </View>
        ) : ventsWithReflections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>No reflections yet</Text>
            <Text style={styles.emptyText}>
              Post a vent to receive AI-powered reflections that help you understand and process your emotions.
            </Text>
          </View>
        ) : (
          ventsWithReflections.map((vent, index) => (
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
                  room: typeof vent.room === 'object' ? vent.room.name : (vent.room || 'General'),
                }}
              />
              {vent.reflection && (
                <Card variant="elevated" style={styles.reflectionCard}>
                  <View style={styles.reflectionContainer}>
                    <Text style={styles.reflectionLabel}>What we heard</Text>
                    <Text style={styles.reflectionText}>{vent.reflection}</Text>
                  </View>
                </Card>
              )}
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

