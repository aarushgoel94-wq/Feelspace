import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { storage } from '~app/models/storage';
import { getNotificationEnabled, setNotificationEnabled } from '~app/utils/notificationSettings';
import { notificationService } from '~app/services/notification.service';
import { BackgroundColorPicker } from '~app/components/shared/BackgroundColorPicker';
import { useTheme } from '~app/contexts/ThemeContext';
import { useAvatar } from '~app/contexts/AvatarContext';
import { isEmotionalMirrorEnabled, setEmotionalMirrorEnabled } from '~app/utils/emotionalMirrorSettings';
import { IconSelectionScreen } from '~app/components/onboarding/IconSelectionScreen';

const SETTINGS_KEYS = {
  HAPTICS_ENABLED: '@feelspace:haptics_enabled',
  ANALYTICS_ENABLED: '@feelspace:analytics_enabled',
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshBackgroundColor } = useTheme();
  const { userIcon, refreshIcon } = useAvatar();
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [emotionalMirrorEnabled, setEmotionalMirrorEnabled] = useState(true);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [showAdminOptions, setShowAdminOptions] = useState(false);
  const [showIconSelection, setShowIconSelection] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const haptics = await AsyncStorage.getItem(SETTINGS_KEYS.HAPTICS_ENABLED);
      const notifications = await getNotificationEnabled();
      const analytics = await AsyncStorage.getItem(SETTINGS_KEYS.ANALYTICS_ENABLED);
      const emotionalMirror = await isEmotionalMirrorEnabled();

      setHapticsEnabled(haptics !== 'false');
      setNotificationsEnabled(notifications);
      setAnalyticsEnabled(analytics !== 'false');
      setEmotionalMirrorEnabled(emotionalMirror);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading settings:', error);
      }
    }
  };

  const handleIconSelected = async (icon: string) => {
    try {
      await storage.setUserIcon(icon);
      // Refresh avatar in context so it updates everywhere
      await refreshIcon();
      setShowIconSelection(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving icon:', error);
      }
      Alert.alert('Error', 'Failed to save icon. Please try again.');
    }
  };

  const handleHapticsToggle = async (value: boolean) => {
    try {
      setHapticsEnabled(value);
      await AsyncStorage.setItem(SETTINGS_KEYS.HAPTICS_ENABLED, value.toString());
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving haptics setting:', error);
      }
      setHapticsEnabled(!value); // Revert on error
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      setNotificationsEnabled(value);
      await setNotificationEnabled(value);
      
      // Re-initialize notification service if enabled
      if (value) {
        // Re-initialize to enable notifications
        // Wrap in try-catch to handle native module errors gracefully
        try {
          await notificationService.initialize();
        } catch (initError: any) {
          // Don't revert the toggle if native module isn't available
          // User can still toggle it, it just won't work until rebuild
          if (__DEV__) {
            console.warn('Notification service initialization failed (native module may not be available):', initError);
          }
        }
      } else {
        // Cancel all scheduled notifications when disabled
        // Wrap in try-catch to handle native module errors gracefully
        try {
          await notificationService.cancelAllNotifications();
        } catch (cancelError: any) {
          // Silently fail - native module may not be available
          if (__DEV__) {
            console.warn('Failed to cancel notifications (native module may not be available):', cancelError);
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving notifications setting:', error);
      }
      // Only revert if it's not a native module error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('native module') && 
          !errorMessage.includes('ExpoPushTokenManager') &&
          !errorMessage.includes('ERR_MODULE_NOT_FOUND')) {
        setNotificationsEnabled(!value); // Revert on error
      }
    }
  };

  const handleAnalyticsToggle = async (value: boolean) => {
    try {
      setAnalyticsEnabled(value);
      await AsyncStorage.setItem(SETTINGS_KEYS.ANALYTICS_ENABLED, value.toString());
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving analytics setting:', error);
      }
      setAnalyticsEnabled(!value); // Revert on error
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your vents, comments, and mood logs. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.clearAll();
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleClearDrafts = () => {
    Alert.alert(
      'Clear All Drafts',
      'This will delete all your draft vents. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const drafts = await storage.getDrafts();
              for (const draft of drafts) {
                await storage.deleteVent(draft.id);
              }
              Alert.alert('Success', 'All drafts have been removed.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear drafts. Please try again.');
            }
          },
        },
      ]
    );
  };

  const { backgroundColor } = useTheme();

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    scrollContent: {
      padding: theme.spacing.md,
      paddingTop: Math.max(insets.top + theme.spacing.sm, theme.spacing.md),
      paddingBottom: theme.spacing.md,
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => {
            // Secret admin access: Tap title 7 times
            if (adminTapCount >= 6) {
              setShowAdminOptions(true);
              setAdminTapCount(0);
            } else {
              setAdminTapCount(adminTapCount + 1);
              setTimeout(() => setAdminTapCount(0), 2000);
            }
          }}
          activeOpacity={1}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>Settings</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Manage your app preferences and data
            </Text>
          </View>
        </TouchableOpacity>

        {/* Admin Section - Hidden */}
        {showAdminOptions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/reports')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>View Reports</Text>
              <Text style={styles.actionButtonDescription}>
                Review and manage user reports
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <BackgroundColorPicker
            onColorChange={() => {
              refreshBackgroundColor();
            }}
          />

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowIconSelection(true)}
            activeOpacity={0.7}
          >
            <View style={styles.iconSelectionRow}>
              <View style={styles.iconSelectionContent}>
                <Text style={styles.actionButtonText}>Choose Icon</Text>
                <Text style={styles.actionButtonDescription}>
                  Select your anonymous handle icon
                </Text>
              </View>
              {userIcon && (
                <Text style={styles.currentIcon}>{userIcon}</Text>
              )}
            </View>
          </TouchableOpacity>

          <SettingItem
            label="Haptic Feedback"
            description="Gentle vibrations for interactions"
            value={hapticsEnabled}
            onValueChange={handleHapticsToggle}
          />

          <SettingItem
            label="Notifications"
            description="Receive reminders and updates"
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
          />

          <SettingItem
            label="Analytics"
            description="Help improve the app (anonymous)"
            value={analyticsEnabled}
            onValueChange={handleAnalyticsToggle}
          />

          <SettingItem
            label="Emotional Mirror"
            description="Receive gentle reflections after posting"
            value={emotionalMirrorEnabled}
            onValueChange={async (value) => {
              setEmotionalMirrorEnabled(value);
              await setEmotionalMirrorEnabled(value);
            }}
          />
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClearDrafts}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText} numberOfLines={1}>Clear All Drafts</Text>
            <Text style={styles.actionButtonDescription} numberOfLines={1}>
              Delete all draft vents from your vault
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearData}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, styles.dangerButtonText]} numberOfLines={1}>
              Clear All Data
            </Text>
            <Text style={[styles.actionButtonDescription, styles.dangerButtonDescription]} numberOfLines={1}>
              Delete all vents, comments, and mood logs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contact & Report Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & Report</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'Report Inappropriate Activity',
                'To report inappropriate content or abusive users, use the menu button (⋯) on any post. All reports are reviewed within 24 hours.',
                [{ text: 'OK' }]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>How to Report</Text>
            <Text style={styles.actionButtonDescription}>
              Learn how to report objectionable content
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/moderator-contact')}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Contact Moderators</Text>
            <Text style={styles.actionButtonDescription}>
              Quick contact, response metrics & report status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'Contact Support',
                'Email: feelspacemood@gmail.com\n\nWe review all reports within 24 hours and take immediate action to remove objectionable content and eject users who violate our community guidelines.',
                [{ text: 'OK' }]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Email Support</Text>
            <Text style={styles.actionButtonDescription}>
              feelspacemood@gmail.com
            </Text>
          </TouchableOpacity>

          <Card variant="elevated" style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              All reports are reviewed within 24 hours. Offending content and users are removed immediately.
            </Text>
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card variant="elevated" style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              Feelspace is a safe, anonymous space for expressing your thoughts and feelings.
            </Text>
            <Text style={styles.aboutText}>
              Your privacy is our priority. All vents are anonymous and stored securely.
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* Icon Selection Modal/Screen */}
      {showIconSelection && (
        <View style={styles.iconSelectionOverlay}>
          <IconSelectionScreen
            onNext={handleIconSelected}
            onBack={() => setShowIconSelection(false)}
          />
        </View>
      )}
    </View>
  );
}

interface SettingItemProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  description,
  value,
  onValueChange,
}) => {
  return (
    <Card variant="elevated" style={styles.settingCard}>
      <View style={styles.settingContent}>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel} allowFontScaling maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.settingDescription} allowFontScaling maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {description}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: theme.colors.border.light,
            true: theme.colors.primary.main,
          }}
          thumbColor={theme.colors.background.primary}
          ios_backgroundColor={theme.colors.border.light}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.sm,
    numberOfLines: 1,
    letterSpacing: -0.5,
    lineHeight: theme.typography.fontSize['4xl'] * theme.typography.lineHeight.tight,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
    numberOfLines: 1,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 1,
  },
  settingCard: {
    marginBottom: theme.spacing.sm,
    padding: 0,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  settingLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs / 2,
    numberOfLines: 1,
  },
  settingDescription: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.xs * theme.typography.lineHeight.relaxed,
    numberOfLines: 1,
  },
  actionButton: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs / 2,
    numberOfLines: 1,
  },
  actionButtonDescription: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.xs * theme.typography.lineHeight.relaxed,
    numberOfLines: 1,
  },
  dangerButton: {
    borderColor: theme.colors.state.error,
    backgroundColor: theme.colors.state.error + '10',
  },
  dangerButtonText: {
    color: theme.colors.state.error,
    opacity: 1,
  },
  dangerButtonDescription: {
    color: theme.colors.state.error,
    opacity: 1,
  },
  aboutCard: {
    padding: theme.spacing.lg,
  },
  aboutText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.sm,
  },
  iconSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconSelectionContent: {
    flex: 1,
  },
  currentIcon: {
    fontSize: 24,
    marginLeft: theme.spacing.sm,
  },
  iconSelectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background.primary,
    zIndex: 1000,
  },
});
