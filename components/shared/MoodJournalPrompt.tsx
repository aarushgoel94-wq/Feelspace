import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { triggerHapticImpact } from '~app/utils/haptics';

interface MoodJournalPromptProps {
  onSave?: (note: string) => void;
  onSkip?: () => void;
}

/**
 * Optional mood journal prompt
 * Appears after mood selection to capture optional thoughts
 */
export const MoodJournalPrompt: React.FC<MoodJournalPromptProps> = ({
  onSave,
  onSkip,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = () => {
    if (isSubmitting) return;

    // Gentle haptic feedback
    triggerHapticImpact();

    setIsSubmitting(true);
    
    // Call onSave immediately (small delay is handled by parent if needed)
    if (onSave) {
      onSave(note.trim());
    }
    setIsSubmitting(false);
  };

  const handleSkip = () => {
    triggerHapticImpact();
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(400)}
      exiting={FadeOut.duration(200)}
    >
      <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
          <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.3}>
            Want to write a short thought?
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Optional..."
            placeholderTextColor={theme.colors.text.tertiary}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={200}
            textAlignVertical="top"
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText} allowFontScaling maxFontSizeMultiplier={1.3}>
                Skip
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, (!note.trim() || isSubmitting) && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={!note.trim() || isSubmitting}
            >
              <Text
                style={[styles.saveButtonText, (!note.trim() || isSubmitting) && styles.saveButtonTextDisabled]}
                allowFontScaling
                maxFontSizeMultiplier={1.3}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  container: {
    paddingVertical: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    minHeight: 80,
    maxHeight: 120,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  skipButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  saveButton: {
    backgroundColor: theme.colors.primary.main,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.border.light,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  saveButtonTextDisabled: {
    color: theme.colors.text.tertiary,
  },
});

