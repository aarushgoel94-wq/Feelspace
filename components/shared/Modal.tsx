import React, { useEffect } from 'react';
import {
  Modal as RNModal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '~app/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissible?: boolean;
  animationType?: 'fade' | 'slide';
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  dismissible = true,
  animationType = 'fade',
}) => {
  useEffect(() => {
    if (visible) {
      // Prevent body scroll on web if needed
    }
  }, [visible]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={dismissible ? onClose : undefined}>
          <Animated.View
            entering={FadeIn.duration(theme.animation.duration.normal)}
            exiting={FadeOut.duration(theme.animation.duration.fast)}
            style={styles.overlay}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                entering={FadeIn.duration(theme.animation.duration.slow).delay(50)}
                style={styles.content}
              >
                {children}
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.large,
  },
});


