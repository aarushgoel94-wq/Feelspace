import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Card } from '~app/components/shared/Card';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { theme } from '~app/theme';
import { MoodLevel } from '~app/models/types';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';
import { triggerHapticImpact } from '~app/utils/haptics';
import { AnimatedMoodButton } from '~app/components/shared/AnimatedMoodButton';

interface PostVentMoodCheckProps {
  moodBefore?: MoodLevel;
  onMoodSelected?: (mood: MoodLevel) => void;
  onSkip?: () => void;
  onComplete?: () => void;
}

// Match the mood options from DailyMoodCheckIn and ComposeVentScreen
interface MoodOption {
  emoji: string;
  label: string;
  moodLevel: MoodLevel;
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

const MOOD_ORDER: MoodLevel[] = ['Low', 'Meh', 'Okay', 'Good', 'Great'];

export const PostVentMoodCheck: React.FC<PostVentMoodCheckProps> = ({
  moodBefore,
  onMoodSelected,
  onSkip,
  onComplete,
}) => {
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleMoodSelect = (mood: MoodLevel) => {
    // Haptic feedback is handled by AnimatedMoodButton
    setSelectedMood(mood);
    
    // Check if mood improved
    if (moodBefore) {
      const beforeIndex = MOOD_ORDER.indexOf(moodBefore);
      const afterIndex = MOOD_ORDER.indexOf(mood);
      const improved = afterIndex > beforeIndex;
      
      if (improved) {
        setShowFeedback(true);
        // Call callback after showing feedback, then complete
        setTimeout(() => {
          if (onMoodSelected) {
            onMoodSelected(mood);
          }
          if (onComplete) {
            setTimeout(() => {
              onComplete();
            }, 500);
          }
        }, 2000);
      } else {
        // Call callback immediately if no improvement feedback
        setTimeout(() => {
          if (onMoodSelected) {
            onMoodSelected(mood);
          }
          if (onComplete) {
            setTimeout(() => {
              onComplete();
            }, 500);
          }
        }, 500);
      }
    } else {
      // No moodBefore, just call callback and complete
      setTimeout(() => {
        if (onMoodSelected) {
          onMoodSelected(mood);
        }
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 500);
        }
      }, 500);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  // Show feedback message if mood improved
  if (showFeedback && selectedMood) {
    return (
      <Animated.View entering={FadeIn.duration(400)}>
        <Card variant="elevated" style={styles.feedbackCard}>
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackEmoji} allowFontScaling>💛</Text>
            <Text 
              style={styles.feedbackMessage}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Glad that helped a little.
            </Text>
          </View>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
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
                    Did this help your mood?
                  </Text>
                  <Text 
                    style={styles.subtitle}
                    allowFontScaling
                    maxFontSizeMultiplier={1.3}
                  >
                    Totally optional — skip if you'd like
                  </Text>

          <View style={styles.moodContainer}>
            {MOOD_OPTIONS.map((mood, index) => (
              <AnimatedMoodButton
                key={mood.label}
                mood={mood}
                isSelected={selectedMood === mood.moodLevel}
                onPress={(moodOption) => handleMoodSelect(moodOption.moodLevel)}
                disabled={!!selectedMood}
                index={index}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={!!selectedMood}
          >
            <Text 
              style={styles.skipButtonText}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Skip
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
  },
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm, // Reduced horizontal padding for more space
    width: '100%', // Ensure full width
  },
  title: {
    fontSize: theme.typography.fontSize.base, // Match DailyMoodCheckIn
    fontWeight: theme.typography.fontWeight.medium, // Match DailyMoodCheckIn
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium, // Match DailyMoodCheckIn
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.base * 1.2, // Tighter line height
    paddingHorizontal: theme.spacing.xs, // Minimal padding
    width: '100%', // Full width to ensure proper text wrapping calculation
    numberOfLines: 1, // Ensure single line
    adjustsFontSizeToFit: true, // Auto-adjust if needed
    minimumFontScale: 0.85, // Minimum scale to prevent too small text
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Better distribution
    alignItems: 'center',
    flexWrap: 'nowrap', // Keep in one line
    width: '100%',
    gap: theme.spacing.xs, // Smaller gap for tighter fit
    paddingHorizontal: 0, // Remove padding to maximize space
    overflow: 'hidden', // Prevent overflow
    marginBottom: theme.spacing.lg,
  },
  skipButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  skipButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  feedbackCard: {
    marginBottom: theme.spacing.lg,
  },
  feedbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  feedbackEmoji: {
    fontSize: 40,
    marginBottom: theme.spacing.md,
  },
  feedbackMessage: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
  },
});

