import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { VentCard } from '~app/components/shared/VentCard';
import { theme } from '~app/theme';
import { api, Vent } from '~app/services/api';
import { storage } from '~app/models/storage';
import { getDeviceId } from '~app/utils/deviceId';

interface VentWithReflection extends Vent {
  reflection?: string | null;
}

interface EmotionalReflectionsSectionProps {
  refreshKey?: number;
}

export const EmotionalReflectionsSection: React.FC<EmotionalReflectionsSectionProps> = ({ refreshKey = 0 }) => {
  const router = useRouter();
  const [ventsWithReflections, setVentsWithReflections] = useState<VentWithReflection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVentsWithReflections();
  }, [refreshKey]);

  const loadVentsWithReflections = async () => {
    try {
      setLoading(true);
      const deviceId = await getDeviceId();
      
      // Try API first
      try {
        const response = await api.getVents();
        // getVents returns { vents: Vent[], total: number }
        const ventsArray = response.vents || [];
        
        // Filter vents that have reflections
        const ventsWithReflections = ventsArray.filter((v: VentWithReflection) => 
          v.reflection && v.reflection.trim().length > 0
        );
        
        // Sort by most recent first
        ventsWithReflections.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setVentsWithReflections(ventsWithReflections);
      } catch (apiError) {
        // Fallback to local storage
        try {
          const localVents = await storage.getAllVents();
          const reflections = await storage.getAllReflections();
          
          // Map local vents to include reflections
          const ventsWithReflections = localVents
            .filter(vent => {
              const ventId = vent.id;
              const reflection = reflections[ventId];
              return reflection && reflection.trim().length > 0;
            })
            .map(vent => {
              const ventId = vent.id;
              const reflection = reflections[ventId];
              return {
                id: vent.id,
                roomId: typeof vent.room === 'string' ? vent.room : '',
                room: typeof vent.room === 'string' ? { id: vent.room, name: vent.room } : vent.room,
                text: vent.text,
                anonymousHandle: vent.anonymousHandle,
                deviceId: '',
                moodBefore: vent.moodBefore || 5,
                moodAfter: vent.moodAfter || 5,
                createdAt: vent.createdAt instanceof Date ? vent.createdAt.toISOString() : new Date(vent.createdAt).toISOString(),
                reflection: reflection || null,
              } as VentWithReflection;
            });
          
          // Sort by most recent first
          ventsWithReflections.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });
          
          setVentsWithReflections(ventsWithReflections);
        } catch (storageError) {
          if (__DEV__) {
            console.error('Error loading reflections from local storage:', storageError);
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  if (ventsWithReflections.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>
            AI-generated reflections on your vents will appear here
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>💭</Text>
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptyText}>
            When you post vents with the AI feature enabled, your emotional reflections will appear here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>
          {ventsWithReflections.length} reflection{ventsWithReflections.length !== 1 ? 's' : ''} on your vents
        </Text>
      </View>

      <View style={styles.reflectionsList}>
        {ventsWithReflections.map((vent, index) => (
          <Animated.View
            key={vent.id}
            entering={FadeInDown.delay(index * 50).duration(300)}
            style={styles.ventWrapper}
          >
            <View style={styles.aiTagContainer}>
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>✨ AI Generated</Text>
              </View>
            </View>
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
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  reflectionsList: {
    gap: theme.spacing.md,
  },
  ventWrapper: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  aiTagContainer: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 10,
  },
  aiTag: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.small,
  },
  aiTagText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.3,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
    minHeight: 200,
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
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
});
