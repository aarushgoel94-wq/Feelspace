import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { triggerHapticImpact, triggerHapticNotification } from '~app/utils/haptics';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CALM_EASING, ANIMATION_DURATION, SCALE } from '~app/utils/animations';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { MoodLevel } from '~app/models/types';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';
import { AnimatedMoodButton } from '~app/components/shared/AnimatedMoodButton';
import { MoodJournalPrompt } from '~app/components/shared/MoodJournalPrompt';

interface MoodOption {
  emoji: string;
  label: string;
  moodLevel: MoodLevel; // Internal mood level
  displayLabel: string; // User-facing label
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😢', label: 'Low', moodLevel: 'Low', displayLabel: 'Tough', color: '#93C5FD' },
  { emoji: '😐', label: 'Meh', moodLevel: 'Meh', displayLabel: 'Meh', color: '#A5B4FC' },
  { emoji: '🙂', label: 'Okay', moodLevel: 'Okay', displayLabel: 'Okay', color: '#818CF8' },
  { emoji: '😊', label: 'Good', moodLevel: 'Good', displayLabel: 'Good', color: '#6366F1' },
  { emoji: '😄', label: 'Great', moodLevel: 'Great', displayLabel: 'Great', color: '#10B981' },
];

interface DailyMoodCheckInProps {
  onMoodSelected?: (mood: MoodLevel, note?: string) => void;
  completedToday?: boolean;
}

export const DailyMoodCheckIn: React.FC<DailyMoodCheckInProps> = ({
  onMoodSelected,
  completedToday = false,
}) => {
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [showSuccess, setShowSuccess] = useState(completedToday);
  const [showJournalPrompt, setShowJournalPrompt] = useState(false);
  const scale = useSharedValue(1);

  // Check if completed today (mock - would check actual storage)
  // In real app, this would check if a mood was logged today
  const isCompletedToday = completedToday || (selectedMood !== null && showSuccess && !showJournalPrompt);

  const handleMoodSelect = (moodOption: MoodOption) => {
    // Soft haptic feedback on selection
    triggerHapticImpact();
    
    setSelectedMood(moodOption.moodLevel);
    
    // Subtle confirmation animation - no bouncy springs
    scale.value = withSequence(
      withTiming(SCALE.confirmation, {
        duration: ANIMATION_DURATION.quick,
        easing: CALM_EASING.smooth,
      }),
      withTiming(1, {
        duration: ANIMATION_DURATION.standard,
        easing: CALM_EASING.smooth,
      })
    );

    // Gentle haptic on confirmation
    setTimeout(() => {
      triggerHapticNotification();
      // Show optional journal prompt instead of immediately showing success
      setShowJournalPrompt(true);
    }, ANIMATION_DURATION.quick);
  };

  const handleJournalSave = (note: string) => {
    // Soft haptic feedback
    triggerHapticNotification();
    
    // Save mood with optional note
    if (onMoodSelected && selectedMood) {
      onMoodSelected(selectedMood, note);
    }
    
    // Smooth transition to success state
    setShowJournalPrompt(false);
    setTimeout(() => {
      setShowSuccess(true);
    }, 100);
  };

  const handleJournalSkip = () => {
    // Soft haptic feedback
    triggerHapticNotification();
    
    // Save mood without note
    if (onMoodSelected && selectedMood) {
      onMoodSelected(selectedMood);
    }
    
    // Smooth transition to success state
    setShowJournalPrompt(false);
    setTimeout(() => {
      setShowSuccess(true);
    }, 100);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Show journal prompt if mood selected but not yet saved
  if (showJournalPrompt && selectedMood) {
    return (
      <Animated.View entering={FadeInDown.delay(150).duration(ANIMATION_DURATION.standard)}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.container}>
            <Text 
              style={styles.title}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              How are you feeling today?
            </Text>
            
            <View style={styles.moodScale}>
              {MOOD_OPTIONS.map((mood, index) => (
                <AnimatedMoodButton
                  key={mood.label}
                  mood={mood}
                  isSelected={selectedMood === mood.moodLevel}
                  onPress={() => {}} // Disabled during journal prompt
                  disabled={true}
                  index={index}
                />
              ))}
            </View>
          </View>
        </Card>
        
        <MoodJournalPrompt
          onSave={handleJournalSave}
          onSkip={handleJournalSkip}
        />
      </Animated.View>
    );
  }

  // If already completed today, show confirmation state
  if (isCompletedToday && showSuccess) {
    // Use selected mood or default to first mood if completed via prop
    const moodToShow = selectedMood || MOOD_OPTIONS[2].moodLevel; // Default to "Okay"
    const completedMood = MOOD_OPTIONS.find(m => m.moodLevel === moodToShow);
    
    return (
      <Animated.View entering={FadeIn.duration(ANIMATION_DURATION.standard)}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.successContainer}>
            <Animated.View style={animatedStyle}>
              <Text style={styles.successEmoji} allowFontScaling maxFontSizeMultiplier={1.3}>💛</Text>
            </Animated.View>
            <Text 
              style={styles.successMessage}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Thanks for checking in
            </Text>
            {completedMood && (
              <View style={styles.completedMoodContainer}>
                <Text style={styles.completedEmoji} allowFontScaling>{completedMood.emoji}</Text>
                <Text 
                  style={styles.completedLabel}
                  allowFontScaling
                  maxFontSizeMultiplier={1.3}
                >
                  {completedMood.displayLabel}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </Animated.View>
    );
  }

  // Show check-in prompt with gradient background
  return (
    <Animated.View entering={FadeInDown.delay(150).duration(ANIMATION_DURATION.standard)}>
      {/* Gradient background container using View with background color */}
      <View style={styles.gradientContainer}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.container}>
            <Text 
              style={styles.title}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              How are you feeling today?
            </Text>
            
            <View style={styles.moodScale}>
              {MOOD_OPTIONS.map((mood, index) => (
                <AnimatedMoodButton
                  key={mood.label}
                  mood={mood}
                  isSelected={selectedMood === mood.moodLevel}
                  onPress={handleMoodSelect}
                  disabled={!!selectedMood}
                  index={index}
                />
              ))}
            </View>
          </View>
        </Card>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    borderRadius: theme.borderRadius['2xl'],
    backgroundColor: theme.colors.primary.subtle, // Gentle gradient-like background
    padding: theme.spacing.sm, // Padding creates gradient effect
    marginBottom: theme.spacing.lg,
  },
  card: {
    marginBottom: 0,
    backgroundColor: theme.colors.background.primary,
  },
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm, // Reduced horizontal padding for more space
    width: '100%', // Ensure full width
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.base * 1.2, // Tighter line height
    paddingHorizontal: theme.spacing.xs, // Minimal padding
    width: '100%', // Full width to ensure proper text wrapping calculation
  },
  moodScale: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Better distribution
    alignItems: 'center',
    flexWrap: 'nowrap', // Keep in one line
    width: '100%',
    gap: theme.spacing.xs, // Smaller gap for tighter fit
    paddingHorizontal: 0, // Remove padding to maximize space
    overflow: 'hidden', // Prevent overflow
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl, // Increased padding
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
    opacity: 0.7,
  },
  successMessage: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  completedMoodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  completedEmoji: {
    fontSize: 28, // Larger emoji
  },
  completedLabel: {
    fontSize: theme.typography.fontSize.lg, // Larger font
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
});
