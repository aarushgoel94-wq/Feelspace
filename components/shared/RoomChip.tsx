import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { theme } from '~app/theme';

interface RoomChipProps {
  room: string;
  selected: boolean;
  onPress: () => void;
}

export const RoomChip: React.FC<RoomChipProps> = ({ room, selected, onPress }) => {
  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: selected ? withSpring(1.05) : withSpring(1) }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.chip,
          selected && styles.chipSelected,
          scale,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            selected && styles.chipTextSelected,
          ]}
        >
          {room}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background.primary,
    borderWidth: 2,
    borderColor: theme.colors.border.light,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.small,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary.subtle,
    borderColor: theme.colors.primary.main,
    borderWidth: 2.5,
    ...theme.shadows.medium,
  },
  chipText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
    numberOfLines: 1,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

