import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TextInputProps, ViewStyle } from 'react-native';
// Speech-to-text removed - no microphone permissions needed
import { theme } from '~app/theme';

interface TextInputWithSpeechProps extends TextInputProps {
  containerStyle?: ViewStyle;
  showSpeechButton?: boolean;
  onSpeechError?: (error: string) => void;
}

export const TextInputWithSpeech: React.FC<TextInputWithSpeechProps> = ({
  value,
  onChangeText,
  containerStyle,
  showSpeechButton = true,
  onSpeechError,
  style,
  ...textInputProps
}) => {
  const [currentText, setCurrentText] = useState(value || '');
  const previousValueRef = React.useRef(value || '');

  // Sync with parent value changes
  React.useEffect(() => {
    if (value !== previousValueRef.current) {
      setCurrentText(value || '');
      previousValueRef.current = value || '';
    }
  }, [value]);

  const handleTextChange = (text: string) => {
    setCurrentText(text);
    previousValueRef.current = text;
    if (onChangeText) {
      onChangeText(text);
    }
  };

  const handleTranscript = (transcript: string) => {
    // For real-time transcription, handle interim and final results
    // Web Speech API sends interim results (in-progress) and final results (complete words)
    if (transcript.trim()) {
      // Check if this is a final result (ends with space) or interim
      const isFinal = transcript.endsWith(' ');
      
      if (isFinal) {
        // Final result - append to existing text
        const newText = currentText ? `${currentText}${transcript}` : transcript.trim();
        handleTextChange(newText);
      } else {
        // Interim result - replace the last interim text
        // Find the last space to determine where interim text starts
        const words = currentText.split(' ');
        const lastWord = words[words.length - 1];
        // If last word looks like it might be interim (no punctuation, short), replace it
        // Otherwise, append
        if (lastWord && lastWord.length < 20 && !lastWord.match(/[.!?]$/)) {
          const baseText = words.slice(0, -1).join(' ');
          handleTextChange(baseText ? `${baseText} ${transcript}` : transcript);
        } else {
          handleTextChange(currentText ? `${currentText} ${transcript}` : transcript);
        }
      }
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...textInputProps}
        value={currentText}
        onChangeText={handleTextChange}
        style={[styles.input, showSpeechButton && styles.inputWithButton, style]}
        placeholderTextColor={theme.colors.text.tertiary}
      />
      {/* Speech-to-text removed - no microphone permissions */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    minHeight: 44, // Minimum touch target
    maxHeight: 100, // Reduced for comment input
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    textAlignVertical: 'top', // For multiline, start text at top
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
  },
  inputWithButton: {
    paddingRight: 48, // Space for speech button on the right (for comment input)
    paddingBottom: theme.spacing.sm,
  },
  speechButtonContainer: {
    position: 'absolute',
    right: theme.spacing.sm, // Position on the right side (for comment input)
    bottom: theme.spacing.sm, // Position at bottom
    zIndex: 10,
  },
});
