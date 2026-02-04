import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { theme } from '~app/theme';
import { Vent } from '~app/services/api';

interface VentVisualCardProps {
  vent: Vent;
  showReflection?: boolean;
}

/**
 * Visual card component for exporting vents as images
 * Minimal, calming design that preserves anonymity
 * Designed to be captured with react-native-view-shot
 */
export const VentVisualCard: React.FC<VentVisualCardProps> = ({
  vent,
  showReflection = false,
}) => {
  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get room name (fallback to "General" if not available)
  const roomName = vent.room?.name || 'General';

  return (
    <View style={styles.container} collapsable={false}>
      {/* Header with app branding */}
      <View style={styles.header}>
        <Text style={styles.appName}>Let It Out</Text>
        <Text style={styles.date}>{formatDate(vent.createdAt)}</Text>
      </View>

      {/* Room badge */}
      <View style={styles.roomBadge}>
        <Text style={styles.roomText}>{roomName}</Text>
      </View>

      {/* Main vent text */}
      <View style={styles.content}>
        <Text style={styles.ventText}>{vent.text}</Text>
      </View>

      {/* Reflection section (if available) */}
      {showReflection && vent.reflection && (
        <View style={styles.reflectionContainer}>
          <View style={styles.reflectionHeader}>
            <Text style={styles.reflectionIcon}>✨</Text>
            <Text style={styles.reflectionTitle}>Reflection</Text>
          </View>
          <Text style={styles.reflectionText}>{vent.reflection}</Text>
        </View>
      )}

      {/* Footer with subtle branding */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Share your thoughts safely and anonymously</Text>
      </View>
    </View>
  );
};

// Fixed dimensions for consistent image export
// Standard Instagram post size: 1080x1080 (we'll use 1080x1350 for portrait)
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: theme.colors.background.primary,
    padding: 80,
    justifyContent: 'space-between',
    // Ensure consistent rendering for image export
    position: 'relative',
  },
  header: {
    marginBottom: 40,
  },
  appName: {
    fontSize: 48,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 24,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  roomBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary.subtle,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    marginBottom: 40,
  },
  roomText: {
    fontSize: 20,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.medium,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 40,
  },
  ventText: {
    fontSize: 36,
    lineHeight: 36 * theme.typography.lineHeight.relaxed,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'left',
  },
  reflectionContainer: {
    marginTop: 60,
    paddingTop: 40,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  reflectionIcon: {
    fontSize: 28,
  },
  reflectionTitle: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  reflectionText: {
    fontSize: 28,
    lineHeight: 28 * theme.typography.lineHeight.relaxed,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  footer: {
    marginTop: 40,
    paddingTop: 40,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  footerText: {
    fontSize: 20,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
});

