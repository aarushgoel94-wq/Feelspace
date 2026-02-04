import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AIReflectionsScreen } from '~app/components/shared/AIReflectionsScreen';
import { theme } from '~app/theme';

export default function AIReflectionsRoute() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <AIReflectionsScreen onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
});

