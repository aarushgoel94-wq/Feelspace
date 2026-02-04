import React, { useRef, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
// @ts-ignore - react-native-view-shot types may not be available
import ViewShot from 'react-native-view-shot';
import { theme } from '~app/theme';
import { Vent } from '~app/services/api';
import { VentVisualCard } from './VentVisualCard';
import { shareVentAsImage } from '~app/utils/shareVent';

interface ShareVentModalProps {
  visible: boolean;
  vent: Vent | null;
  showReflection?: boolean;
  onClose: () => void;
}

/**
 * Modal component for sharing vents as visual cards
 * Contains the visual card and handles the sharing process
 */
export const ShareVentModal: React.FC<ShareVentModalProps> = ({
  visible,
  vent,
  showReflection = false,
  onClose,
}) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!vent || !viewShotRef.current) {
      return;
    }

    setSharing(true);
    try {
      await shareVentAsImage(viewShotRef, vent, showReflection);
      // Close modal after successful share
      // Share function handles all errors silently
      onClose();
    } catch (error) {
      // Silently handle errors - don't show error messages
      // The share function already handles all error cases
      if (__DEV__) {
        console.warn('Error sharing vent:', error);
      }
    } finally {
      setSharing(false);
    }
  };

  if (!vent) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Hidden card for capture - positioned off-screen */}
          <View style={styles.hiddenCardContainer}>
            <ViewShot
              ref={viewShotRef}
              options={{
                format: 'png',
                quality: 1.0,
                result: 'tmpfile',
              }}
              style={styles.viewShot}
            >
              <VentVisualCard vent={vent} showReflection={showReflection} />
            </ViewShot>
          </View>

          {/* Preview card (visible to user) */}
          <View style={styles.previewContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.previewScrollContent}
              bounces={false}
            >
              <VentVisualCard vent={vent} showReflection={showReflection} />
            </ScrollView>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={sharing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.shareButton, sharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator color={theme.colors.text.inverse} />
              ) : (
                <Text style={styles.shareButtonText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  hiddenCardContainer: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    opacity: 0,
  },
  viewShot: {
    width: 1080,
    height: 1350,
  },
  previewContainer: {
    marginBottom: theme.spacing.xl,
    maxHeight: 500,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.secondary,
    overflow: 'hidden',
  },
  previewScrollContent: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  shareButton: {
    backgroundColor: theme.colors.primary.main,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
  },
});

