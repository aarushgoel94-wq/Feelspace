import React, { useState, useEffect } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '~app/theme';

interface CustomTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  multiline?: boolean;
  rows?: number;
}

export const TextInput: React.FC<CustomTextInputProps> = ({
  label,
  error,
  containerStyle,
  multiline = false,
  rows = 4,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = useSharedValue(theme.colors.border.light);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      borderColor.value = withTiming(theme.colors.primary.main, {
        duration: theme.animation.duration.normal,
      });
      scale.value = withSpring(1.01, {
        damping: 15,
        stiffness: 300,
      });
    } else {
      borderColor.value = withTiming(
        error ? theme.colors.state.error : theme.colors.border.light,
        {
          duration: theme.animation.duration.normal,
        }
      );
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    }
  }, [isFocused, error]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.inputContainer, animatedContainerStyle]}>
        <RNTextInput
          style={[
            styles.input,
            multiline && { minHeight: rows * 24, textAlignVertical: 'top' },
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          {...props}
        />
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  inputContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  input: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
  },
  error: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.state.error,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.regular,
  },
});


