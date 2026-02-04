import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Ellipse, Polygon } from 'react-native-svg';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { calculateCompanionEvolution, CompanionAccessory } from '~app/utils/companionEvolution';

interface CompanionCharacterProps {
  moodTrend?: 'happy' | 'calm' | 'tired' | 'neutral';
}

export const CompanionCharacter: React.FC<CompanionCharacterProps> = ({
  moodTrend = 'neutral',
}) => {
  const [evolution, setEvolution] = useState<{ accessory: CompanionAccessory; expressionVariant: number }>({
    accessory: 'none',
    expressionVariant: 1,
  });

  // Load companion evolution state
  useEffect(() => {
    const loadEvolution = async () => {
      try {
        const allLogs = await storage.getAllMoodLogs();
        const evolutionState = calculateCompanionEvolution(allLogs);
        setEvolution(evolutionState);
      } catch (error) {
        // Silently handle errors
      }
    };
    loadEvolution();
  }, []);

  // Subtle idle animation
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Gentle floating animation
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );

    // Subtle breathing animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 3000 }),
        withTiming(1, { duration: 3000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Character expression based on mood
  const getCharacterColor = () => {
    switch (moodTrend) {
      case 'happy':
        return theme.colors.accent.sage;
      case 'calm':
        return theme.colors.primary.main;
      case 'tired':
        return theme.colors.text.tertiary;
      default:
        return theme.colors.primary.light;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.characterContainer, animatedStyle]}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          {/* Friendly panda-style character */}
          {/* Main body circle */}
          <Circle cx="60" cy="70" r="30" fill={getCharacterColor()} />
          
          {/* Head */}
          <Circle cx="60" cy="38" r="24" fill="#FFFFFF" />
          
          {/* Ears */}
          <Circle cx="43" cy="22" r="9" fill={getCharacterColor()} />
          <Circle cx="77" cy="22" r="9" fill={getCharacterColor()} />
          <Circle cx="43" cy="22" r="5" fill="#FFFFFF" opacity={0.4} />
          <Circle cx="77" cy="22" r="5" fill="#FFFFFF" opacity={0.4} />
          
          {/* Eyes */}
          <Circle cx="53" cy="38" r="4" fill={theme.colors.text.primary} />
          <Circle cx="67" cy="38" r="4" fill={theme.colors.text.primary} />
          
          {/* Eye highlights */}
          <Circle cx="54" cy="37" r="1.5" fill="#FFFFFF" />
          <Circle cx="68" cy="37" r="1.5" fill="#FFFFFF" />
          
          {/* Expression based on mood */}
          {moodTrend === 'happy' && (
            <>
              {/* Happy smile */}
              <Path
                d="M 50 48 Q 60 54 70 48"
                stroke={theme.colors.text.primary}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {moodTrend === 'calm' && (
            <>
              {/* Calm/neutral mouth */}
              <Path
                d="M 52 48 Q 60 50 68 48"
                stroke={theme.colors.text.primary}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {moodTrend === 'tired' && (
            <>
              {/* Tired/droopy eyes */}
              <Path
                d="M 49 38 Q 53 40 57 38"
                stroke={theme.colors.text.primary}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 63 38 Q 67 40 71 38"
                stroke={theme.colors.text.primary}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {moodTrend === 'neutral' && (
            <>
              {/* Neutral expression */}
              <Circle cx="55" cy="47" r="1.5" fill={theme.colors.text.primary} />
              <Circle cx="65" cy="47" r="1.5" fill={theme.colors.text.primary} />
            </>
          )}
          
          {/* Blush (for happy mood) */}
          {moodTrend === 'happy' && (
            <>
              <Ellipse cx="45" cy="45" rx="3" ry="2" fill="#FCA5A5" opacity={0.4} />
              <Ellipse cx="75" cy="45" rx="3" ry="2" fill="#FCA5A5" opacity={0.4} />
            </>
          )}

          {/* Companion Accessories - Cosmetic Evolution */}
          {evolution.accessory === 'scarf' && (
            <Path
              d="M 50 45 Q 60 50 70 45"
              stroke={theme.colors.accent.sage}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              opacity={0.8}
            />
          )}
          {evolution.accessory === 'hat' && (
            <>
              <Circle cx="60" cy="18" r="12" fill={theme.colors.primary.main} opacity={0.9} />
              <Path
                d="M 48 18 Q 60 12 72 18 L 68 24 L 52 24 Z"
                fill={theme.colors.primary.main}
                opacity={0.9}
              />
            </>
          )}
          {evolution.accessory === 'flower' && (
            <>
              {/* Small flower on ear */}
              <Circle cx="48" cy="18" r="3" fill="#FCA5A5" />
              <Circle cx="49" cy="17" r="1.5" fill="#FCD34D" />
              <Circle cx="47" cy="17" r="1.5" fill="#FCD34D" />
              <Circle cx="48" cy="16" r="1.5" fill="#FCD34D" />
            </>
          )}
          {evolution.accessory === 'star' && (
            <>
              {/* Small star on forehead */}
              <Polygon
                points="60,14 61,17 64,17 62,19 63,22 60,20 57,22 58,19 56,17 59,17"
                fill="#FCD34D"
                opacity={0.8}
              />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  characterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

