import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { useAvatar } from '~app/contexts/AvatarContext';

interface GreetingSectionProps {
  userName?: string; // Kept for backward compatibility but not used
}

// Friendly and inviting greetings with matching emojis
const GREETINGS = [
  { text: 'Welcome back', emoji: '👋', color: '#6366F1' },
  { text: 'Hello again', emoji: '✨', color: '#818CF8' },
  { text: 'Good to see you', emoji: '🌱', color: '#A78BFA' },
  { text: 'Nice to have you here', emoji: '💜', color: '#6366F1' },
  { text: 'Glad you\'re here', emoji: '🌸', color: '#818CF8' },
  { text: 'Welcome', emoji: '🌿', color: '#A78BFA' },
  { text: 'Hello', emoji: '💫', color: '#6366F1' },
  { text: 'Hi there', emoji: '☀️', color: '#818CF8' },
  { text: 'Hey', emoji: '🌙', color: '#A78BFA' },
  { text: 'Welcome home', emoji: '🏠', color: '#6366F1' },
  { text: 'You\'re back', emoji: '💚', color: '#818CF8' },
  { text: 'Here for you', emoji: '🤗', color: '#A78BFA' },
  { text: 'Take your time', emoji: '🧘', color: '#6366F1' },
  { text: 'This is your space', emoji: '🌌', color: '#818CF8' },
  { text: 'You belong here', emoji: '💙', color: '#A78BFA' },
];

// Get a random greeting (consistent per session)
const getGreeting = () => {
  // Use a simple hash of the current day to get consistent greeting per day
  // This way it changes daily but stays the same throughout the day
  const today = new Date();
  const dayHash = today.getDate() + today.getMonth() * 31 + today.getFullYear() * 365;
  const index = dayHash % GREETINGS.length;
  return GREETINGS[index];
};

export const GreetingSection: React.FC<GreetingSectionProps> = () => {
  const [greeting] = React.useState(() => getGreeting());
  const { userIcon } = useAvatar();
  
  // Subtle floating animation for the emoji/icon
  const emojiScale = useSharedValue(1);
  const emojiTranslateY = useSharedValue(0);
  
  React.useEffect(() => {
    // Gentle floating animation
    emojiScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
    
    emojiTranslateY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const emojiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: emojiScale.value },
      { translateY: emojiTranslateY.value },
    ],
  }));

  return (
    <Animated.View 
      entering={FadeInDown.duration(400).delay(100)}
      style={styles.container}
    >
      {/* Card container with subtle background */}
      <View style={styles.cardContainer}>
        {/* Decorative accent circle */}
        <View style={styles.accentCircle} />
        
        <View style={styles.contentContainer}>
          {/* Animated emoji/icon */}
          <Animated.View style={[styles.emojiContainer, emojiAnimatedStyle]}>
            <Text style={styles.emoji}>{userIcon || greeting.emoji}</Text>
          </Animated.View>
          
          {/* Greeting text */}
          <View style={styles.textContainer}>
            <Text 
              style={styles.greetingText}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              {greeting.text}
            </Text>
            
            {/* Subtle decorative line */}
            <View style={styles.decorativeLine} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0, // Spacing handled by parent
  },
  cardContainer: {
    borderRadius: theme.borderRadius['2xl'],
    backgroundColor: theme.colors.primary.subtle,
    padding: theme.spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadows.medium,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  accentCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary.main,
    opacity: 0.08,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    position: 'relative',
    zIndex: 1,
  },
  emojiContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.small,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  emoji: {
    fontSize: 32,
  },
  textContainer: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  greetingText: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: -0.5,
    lineHeight: theme.typography.fontSize['4xl'] * theme.typography.lineHeight.tight,
  },
  decorativeLine: {
    width: 40,
    height: 3,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary.main,
    opacity: 0.4,
    marginTop: theme.spacing.xs / 2,
  },
});

