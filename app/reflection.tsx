import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ReflectionScreen } from '~app/components/shared/ReflectionScreen';
import { theme } from '~app/theme';

export default function ReflectionScreenRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moodBefore?: string }>();

  // Get moodBefore from params if available (optional)
  const moodBefore = params.moodBefore ? parseInt(params.moodBefore, 10) : undefined;

  const handleComplete = () => {
    // Navigate back to home - dismiss all modals first
    // Use dismissAll if available, otherwise go back twice (reflection + compose)
    if (router.dismissAll) {
      router.dismissAll();
    } else {
      // Go back through the modal stack
      if (router.canGoBack()) {
        router.back(); // Dismiss reflection
      }
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back(); // Dismiss compose
        }
      }, 50);
    }
    
    // Then navigate to vault tab to show the new insight
    setTimeout(() => {
      router.replace('/(tabs)/vault');
    }, 150);
  };

  return (
    <View style={styles.container}>
      <ReflectionScreen onComplete={handleComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
});
