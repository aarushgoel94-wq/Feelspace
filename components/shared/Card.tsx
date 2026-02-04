import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '~app/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  style?: ViewStyle;
  padding?: keyof typeof theme.spacing;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
  padding = 'lg',
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return { ...theme.shadows.medium, backgroundColor: theme.colors.background.primary };
      case 'outlined':
        return {
          backgroundColor: theme.colors.background.primary,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
        };
      default:
        return { backgroundColor: theme.colors.background.primary };
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(theme.animation.duration.normal)}
      exiting={FadeOut.duration(theme.animation.duration.fast)}
      style={[
        styles.card,
        getVariantStyle(),
        { padding: theme.spacing[padding] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius['2xl'], // Softer, more premium
  },
});


