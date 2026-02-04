import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ComposeVentScreen } from '~app/components/shared/ComposeVentScreen';
import { theme } from '~app/theme';

export default function ComposeScreen() {
  const router = useRouter();

  const handlePost = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <ComposeVentScreen
        onPost={handlePost}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
});
