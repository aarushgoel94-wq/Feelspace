import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { theme } from '~app/theme';

interface Room {
  id: string;
  name: string;
}

interface AnimatedRoomChipProps {
  room: Room;
  index: number;
  onPress: (room: Room) => void;
}

// Generate subtle tonal variations of primary accent
const getRoomColor = (index: number): string => {
  const baseColor = theme.colors.primary.main;
  // Create subtle variations using opacity and slight hue shifts
  const variations = [
    'rgba(99, 102, 241, 0.12)', // Primary with low opacity
    'rgba(99, 102, 241, 0.10)',
    'rgba(129, 140, 248, 0.12)', // Lighter shade
    'rgba(99, 102, 241, 0.08)',
    'rgba(129, 140, 248, 0.10)',
    'rgba(99, 102, 241, 0.12)',
    'rgba(129, 140, 248, 0.08)',
    'rgba(99, 102, 241, 0.10)',
  ];
  return variations[index % variations.length];
};

const getBorderColor = (index: number): string => {
  const variations = [
    'rgba(99, 102, 241, 0.25)',
    'rgba(99, 102, 241, 0.20)',
    'rgba(129, 140, 248, 0.25)',
    'rgba(99, 102, 241, 0.20)',
    'rgba(129, 140, 248, 0.22)',
    'rgba(99, 102, 241, 0.25)',
    'rgba(129, 140, 248, 0.20)',
    'rgba(99, 102, 241, 0.22)',
  ];
  return variations[index % variations.length];
};

export const AnimatedRoomChip: React.FC<AnimatedRoomChipProps> = ({
  room,
  index,
  onPress,
}) => {
  const chipScale = useSharedValue(1);
  const chipOpacity = useSharedValue(1);

  const chipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chipScale.value }],
    opacity: chipOpacity.value,
  }));

  const handlePressIn = () => {
    chipScale.value = withTiming(0.95, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });
    chipOpacity.value = withTiming(0.85, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });
  };

  const handlePressOut = () => {
    chipScale.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
    chipOpacity.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  };

  const backgroundColor = getRoomColor(index);
  const borderColor = getBorderColor(index);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={chipAnimatedStyle}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          setTimeout(() => {
            onPress(room);
          }, 150);
        }}
      >
        <View style={[styles.roomChip, { backgroundColor, borderColor }]}>
          <Text style={styles.roomName} allowFontScaling maxFontSizeMultiplier={1.3}>
            {room.name}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  roomChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    minWidth: '30%', // Ensure at least 3 columns
    maxWidth: '48%', // Ensure at least 2 columns
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
  },
});

