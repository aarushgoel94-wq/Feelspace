import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { MoodValue } from '~app/models/types';

interface MoodOption {
  value: MoodValue;
  label: string;
  emoji: string;
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { value: 'peaceful', label: 'Peaceful', emoji: '😌', color: '#A78BFA' },
  { value: 'calm', label: 'Calm', emoji: '🧘', color: '#818CF8' },
  { value: 'content', label: 'Content', emoji: '🙂', color: '#6366F1' },
  { value: 'hopeful', label: 'Hopeful', emoji: '✨', color: '#60A5FA' },
  { value: 'grateful', label: 'Grateful', emoji: '💝', color: '#34D399' },
  { value: 'anxious', label: 'Anxious', emoji: '😰', color: '#FBBF24' },
  { value: 'tired', label: 'Tired', emoji: '😴', color: '#94A3B8' },
  { value: 'overwhelmed', label: 'Overwhelmed', emoji: '😵', color: '#FB923C' },
  { value: 'sad', label: 'Sad', emoji: '😢', color: '#60A5FA' },
  { value: 'angry', label: 'Angry', emoji: '😠', color: '#F87171' },
  { value: 'numb', label: 'Numb', emoji: '😐', color: '#9CA3AF' },
  { value: 'mixed', label: 'Mixed', emoji: '🤷', color: '#A78BFA' },
];

interface MoodSelectorProps {
  selectedMood?: MoodValue;
  onSelect: (mood: MoodValue) => void;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({
  selectedMood,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling?</Text>
      <Text style={styles.subtitle}>Choose whatever feels right</Text>
      
      <View style={styles.grid}>
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = selectedMood === mood.value;
          
          return (
            <Animated.View
              key={mood.value}
              entering={FadeIn.delay(index * 30).duration(300)}
            >
              <TouchableOpacity
                style={[
                  styles.moodButton,
                  isSelected && { 
                    backgroundColor: mood.color + '20',
                    borderColor: mood.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => onSelect(mood.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{mood.emoji}</Text>
                <Text
                  style={[
                    styles.label,
                    isSelected && { color: mood.color, fontWeight: '600' },
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl, // Premium padding
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'], // Large welcoming header
    fontWeight: theme.typography.fontWeight.medium, // Use weight sparingly
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize['2xl'] * theme.typography.lineHeight.normal,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base, // Larger
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing['2xl'], // Premium spacing
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.lg, // More breathing room - Daylio style
  },
  moodButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'], // Softer
    borderWidth: 1.5, // Thinner, softer
    borderColor: theme.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg, // More padding
    ...theme.shadows.small,
  },
  emoji: {
    fontSize: 36, // Larger emoji
    marginBottom: theme.spacing.sm, // More spacing
  },
  label: {
    fontSize: theme.typography.fontSize.sm, // Larger text
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
  },
});

