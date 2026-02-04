import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, PanResponder, GestureResponderEvent } from 'react-native';
import { theme } from '~app/theme';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

// We'll use percentage-based widths instead of fixed screen width

interface MoodSliderProps {
  beforeValue: number;
  afterValue: number;
  onBeforeChange: (value: number) => void;
  onAfterChange: (value: number) => void;
}

export const MoodSlider: React.FC<MoodSliderProps> = ({
  beforeValue,
  afterValue,
  onBeforeChange,
  onAfterChange,
}) => {
  const getMoodLabel = (value: number) => {
    if (value <= 2) return 'Very Low';
    if (value <= 4) return 'Low';
    if (value <= 6) return 'Neutral';
    if (value <= 8) return 'Better';
    return 'Much Better';
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(theme.animation.duration.normal)}
      style={styles.container}
    >
      {/* Before Slider */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel} numberOfLines={1}>Before</Text>
          <Text style={styles.moodLabel} numberOfLines={1}>{getMoodLabel(beforeValue)}</Text>
        </View>
        <CustomSlider
          value={beforeValue}
          onValueChange={onBeforeChange}
          color={theme.colors.primary.main}
        />
      </View>

      {/* After Slider */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel} numberOfLines={1}>After</Text>
          <Text style={styles.moodLabel} numberOfLines={1}>{getMoodLabel(afterValue)}</Text>
        </View>
        <CustomSlider
          value={afterValue}
          onValueChange={onAfterChange}
          color={theme.colors.accent.sage}
        />
      </View>
    </Animated.View>
  );
};

interface CustomSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  color: string;
}

const CustomSlider: React.FC<CustomSliderProps> = ({ value, onValueChange, color }) => {
  // Use a ref to measure the actual container width
  const [containerWidth, setContainerWidth] = React.useState(0);
  const containerRef = React.useRef<View>(null);
  
  // sliderWidth is now containerWidth - no need for separate variable
  const fillWidthShared = useSharedValue(0);
  const thumbPositionShared = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Measure container width on mount and layout
  const handleLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  React.useEffect(() => {
    if (containerWidth > 0 && !isDragging.value) {
      // Calculate position, ensuring thumb stays within bounds
      // Thumb is 24px wide, centered on track, so we need to account for 12px on each side
      const maxPosition = containerWidth;
      const newFillWidth = Math.min(((value - 1) / 9) * containerWidth, maxPosition);
      fillWidthShared.value = withTiming(newFillWidth, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
      // Clamp thumb position to ensure it doesn't overflow
      const clampedThumbPosition = Math.max(0, Math.min(newFillWidth, maxPosition));
      thumbPositionShared.value = withTiming(clampedThumbPosition, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [value, containerWidth, isDragging]);

  const lastValueRef = React.useRef(value);
  
  const updateValue = React.useCallback((x: number) => {
    if (containerWidth <= 0) return;
    // Calculate value with better precision
    const percentage = Math.max(0, Math.min(1, x / containerWidth));
    const newValue = Math.round(percentage * 9) + 1;
    const clampedValue = Math.max(1, Math.min(10, newValue));
    // Only update if value actually changed to prevent unnecessary re-renders
    if (clampedValue !== lastValueRef.current) {
      lastValueRef.current = clampedValue;
      onValueChange(clampedValue);
    }
  }, [containerWidth, onValueChange]);
  
  // Update ref when value prop changes
  React.useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  const handlePress = (event: any) => {
    // Only handle press if not currently dragging
    if (isDragging.value) return;
    const { locationX } = event.nativeEvent;
    updateValue(locationX);
    // Provide immediate visual feedback
    fillWidthShared.value = Math.max(0, Math.min(containerWidth, locationX));
    thumbPositionShared.value = Math.max(0, Math.min(containerWidth, locationX));
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if user is actually dragging (not just a tap)
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        if (containerWidth <= 0) return;
        isDragging.value = true;
        const { locationX } = event.nativeEvent;
        // Clamp to ensure thumb stays within track bounds
        const clampedX = Math.max(0, Math.min(containerWidth, locationX));
        // Instant update on grant - no animation delay
        fillWidthShared.value = clampedX;
        thumbPositionShared.value = clampedX;
        updateValue(clampedX);
      },
      onPanResponderMove: (event: GestureResponderEvent) => {
        if (containerWidth <= 0 || !isDragging.value) return;
        const { locationX } = event.nativeEvent;
        // Clamp to ensure thumb stays within track bounds
        const clampedX = Math.max(0, Math.min(containerWidth, locationX));
        // Direct assignment for smooth, responsive dragging - no animation during drag
        fillWidthShared.value = clampedX;
        thumbPositionShared.value = clampedX;
        updateValue(clampedX);
      },
      onPanResponderRelease: () => {
        isDragging.value = false;
      },
      onPanResponderTerminate: () => {
        isDragging.value = false;
      },
      onPanResponderTerminationRequest: () => false, // Don't allow termination during drag
    })
  ).current;

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidthShared.value,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbPositionShared.value }],
  }));

  return (
    <View 
      ref={containerRef}
      style={sliderStyles.container}
      onLayout={handleLayout}
    >
      <View
        style={sliderStyles.trackContainer}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={sliderStyles.trackTouchable}
          onPress={handlePress}
          activeOpacity={1}
          delayPressIn={0} // Remove delay for immediate response
          delayPressOut={0}
        >
          <View style={sliderStyles.trackBackground}>
            <Animated.View
              style={[
                sliderStyles.trackFill,
                { backgroundColor: color },
                fillStyle,
              ]}
            />
            <Animated.View
              style={[
                sliderStyles.thumb,
                { backgroundColor: color },
                thumbStyle,
              ]}
            />
          </View>
        </TouchableOpacity>
      </View>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.endLabel} numberOfLines={1}>1</Text>
        <Text style={sliderStyles.endLabel} numberOfLines={1}>10</Text>
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
    width: '100%',
    alignSelf: 'stretch',
  },
  trackContainer: {
    height: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    width: '100%',
    alignSelf: 'stretch',
    // Increase touch target for better responsiveness
    minHeight: 44,
  },
  trackTouchable: {
    width: '100%',
    alignSelf: 'stretch',
    // Ensure full touch area is accessible
    minHeight: 44,
  },
  trackBackground: {
    height: 4,
    backgroundColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.full,
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
  },
  trackFill: {
    height: 4,
    borderRadius: theme.borderRadius.full,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    width: 28, // Slightly larger for easier grabbing
    height: 28, // Slightly larger for easier grabbing
    borderRadius: theme.borderRadius.full,
    position: 'absolute',
    top: -12, // Adjusted for larger thumb
    left: -14, // Adjusted for larger thumb
    ...theme.shadows.medium, // More visible shadow
    // Increase touch target
    zIndex: 10,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: 0,
  },
  endLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary, // Darker
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xl,
  },
  sliderSection: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg + 12, // Extra horizontal padding for thumb (12px on each side)
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    alignSelf: 'stretch',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sliderLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  moodLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary, // Darker
    fontFamily: theme.typography.fontFamily.medium,
    numberOfLines: 1,
    fontWeight: theme.typography.fontWeight.medium,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  endLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary, // Darker
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

