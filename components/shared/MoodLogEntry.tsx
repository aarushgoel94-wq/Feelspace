import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { MoodSelector } from '~app/components/shared/MoodSelector';
import { theme } from '~app/theme';
import { MoodValue } from '~app/models/types';

interface MoodLogEntryProps {
  onSave: (mood: MoodValue, note?: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const MoodLogEntry: React.FC<MoodLogEntryProps> = ({
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [selectedMood, setSelectedMood] = useState<MoodValue>();
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (selectedMood) {
      onSave(selectedMood, note.trim() || undefined);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card variant="elevated" style={styles.card}>
          <MoodSelector
            selectedMood={selectedMood}
            onSelect={setSelectedMood}
          />

          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Add a note (optional)</Text>
            <Text style={styles.noteHint}>
              Any thoughts or reflections you'd like to remember
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="How are you doing today?"
              placeholderTextColor={theme.colors.text.tertiary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{note.length}/500</Text>
          </View>

          <View style={styles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
            <PrimaryButton
              title="Save"
              onPress={handleSave}
              disabled={!selectedMood || isLoading}
              style={styles.saveButton}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
  },
  card: {
    padding: 0,
  },
  noteSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  noteLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
  },
  noteHint: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.md,
  },
  noteInput: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    minHeight: 100,
    maxHeight: 150,
  },
  charCount: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  saveButton: {
    flex: 2,
  },
});





