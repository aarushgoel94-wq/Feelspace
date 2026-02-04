import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { Card } from '~app/components/shared/Card';
import { api } from '~app/services/api';
import { getDeviceId } from '~app/utils/deviceId';
import { sessionManager } from '~app/models/session';
import { storage } from '~app/models/storage';
import { mixpanelService } from '~app/services/mixpanel.service';
import { censorProfanity } from '~app/utils/contentModeration';
import { CALM_EASING, ANIMATION_DURATION, SCALE } from '~app/utils/animations';
import { triggerHapticImpact } from '~app/utils/haptics';
import { useAvatar } from '~app/contexts/AvatarContext';

interface Vent {
  id: string;
  handle: string;
  text: string;
  room: string;
}

interface VentCardProps {
  vent: Vent;
}

export const VentCard: React.FC<VentCardProps> = ({ vent }) => {
  const router = useRouter();
  const [reactions, setReactions] = useState({
    comment: false,
    support: false,
    empathy: false,
  });
  const [reactionCounts, setReactionCounts] = useState({
    comment: 0,
    support: 0,
    empathy: 0,
  });
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isOwnVent, setIsOwnVent] = useState(false);
  const { userIcon } = useAvatar();

  useEffect(() => {
    // Initialize device ID and fetch reactions - optimized with parallel loading
    const initialize = async () => {
      try {
        // Load all data in parallel for faster initialization
        const [id, handle] = await Promise.all([
          getDeviceId(),
          Promise.resolve((vent as any).anonymousHandle || vent.handle || ''),
        ]);
        
        setDeviceId(id);
        api.setDeviceId(id);

        // Load all storage checks in parallel
        const [blocked, hidden, anonymousHandle] = await Promise.all([
          storage.isUserBlocked(handle),
          storage.isPostHidden(vent.id),
          Promise.resolve(sessionManager.getAnonymousHandle()),
        ]);
        
        setIsBlocked(blocked);
        setIsHidden(hidden);
        // Check if this is the user's own vent
        const ventHandle = (vent as any).anonymousHandle || vent.handle || '';
        setIsOwnVent(ventHandle === anonymousHandle);

        // Load reactions and comments in parallel
        const [localReactions, localComments] = await Promise.all([
          storage.getReactionsByVent(vent.id),
          storage.getCommentsByVent(vent.id).catch(() => []),
        ]);
        
        const userReactions = {
          comment: false,
          support: localReactions.some(r => r.type === 'support' && r.handle === anonymousHandle),
          empathy: localReactions.some(r => r.type === 'empathy' && r.handle === anonymousHandle),
        };
        setReactions(userReactions);
        setCommentCount(localComments.length);
        
        // Set local counts immediately
        const counts = {
          comment: localComments.length,
          support: localReactions.filter(r => r.type === 'support').length,
          empathy: localReactions.filter(r => r.type === 'empathy').length,
        };
        setReactionCounts(counts);

        // Try API in background (non-blocking)
        Promise.all([
          api.getReactionCounts(vent.id).then(counts => {
            setReactionCounts(counts);
            return counts;
          }).catch(() => null),
          api.getComments(vent.id).then(comments => {
            setCommentCount(comments.length);
            return comments;
          }).catch(() => null),
          api.getReactions(vent.id).then(apiReactions => {
            const userApiReactions = {
              comment: false,
              support: apiReactions.some(r => r.type === 'support' && r.anonymousHandle === anonymousHandle),
              empathy: apiReactions.some(r => r.type === 'empathy' && r.anonymousHandle === anonymousHandle),
            };
            setReactions(userApiReactions);
            return apiReactions;
          }).catch(() => null),
        ]).catch(() => {
          // Silently fail - local data already set
        });
      } catch (error) {
        if (__DEV__) {
          console.error('Error fetching reactions:', error);
        }
        // Continue with default state on error - don't disable buttons
        setDeviceId(null); // Will allow buttons to work with local storage
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [vent.id]);

  const handleReaction = async (type: 'comment' | 'support' | 'empathy') => {
    // Comment button navigates to detail screen - always works
    if (type === 'comment') {
      router.push(`/vent/${vent.id}`);
      return;
    }

    // Get device ID if not already set
    let currentDeviceId = deviceId;
    if (!currentDeviceId) {
      try {
        currentDeviceId = await getDeviceId();
        setDeviceId(currentDeviceId);
        if (currentDeviceId) {
          api.setDeviceId(currentDeviceId);
        }
      } catch (error) {
        // Continue without device ID - will use local storage only
      }
    }

    const wasActive = reactions[type];
    const previousCount = reactionCounts[type];

    // Optimistic update
    setReactions((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
    setReactionCounts((prev) => ({
      ...prev,
      [type]: wasActive ? prev[type] - 1 : prev[type] + 1,
    }));

    try {
      const anonymousHandle = sessionManager.getAnonymousHandle();
      
      // Always save to local storage first for offline support
      if (wasActive) {
        // Remove reaction
        const localReactions = await storage.getReactionsByVent(vent.id);
        const userReaction = localReactions.find(
          r => r.type === type && r.handle === anonymousHandle
        );
        if (userReaction) {
          await storage.deleteReaction(userReaction.id);
        }
      } else {
        // Add reaction
        await storage.createReaction({
          ventId: vent.id,
          type,
          anonymousHandle,
        });
      }

      // Try to sync with backend (queue if offline)
      if (currentDeviceId) {
        try {
          const { offlineSync } = await import('~app/services/offlineSync');
          const isOnline = offlineSync.getIsOnline();
          
          if (isOnline) {
            // Try API immediately if online
            try {
              const result = await api.createReaction({
                ventId: vent.id,
                type,
                anonymousHandle,
                deviceId: currentDeviceId,
              });

              if (result && !wasActive) {
                // Track support_received if this is a support/empathy reaction
                if (type === 'support' || type === 'empathy') {
                  mixpanelService.trackSupportReceived({
                    ventId: vent.id,
                    commentType: type,
                  }).catch(() => {});
                }
              }
            } catch (apiError) {
              // Queue for sync later if API fails
              await offlineSync.queueAction('reaction', 'create', {
                ventId: vent.id,
                type,
                anonymousHandle,
                deviceId: currentDeviceId,
              });
            }
          } else {
            // Queue for sync when online
            await offlineSync.queueAction('reaction', 'create', {
              ventId: vent.id,
              type,
              anonymousHandle,
              deviceId: currentDeviceId,
            });
          }
        } catch (syncError) {
          // Silently fail - reaction is already saved locally
          if (__DEV__) {
            console.warn('Failed to queue reaction for sync:', syncError);
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error creating reaction:', error);
      }
      // Revert optimistic update on error
      setReactions((prev) => ({
        ...prev,
        [type]: wasActive,
      }));
      setReactionCounts((prev) => ({
        ...prev,
        [type]: previousCount,
      }));
    }
  };

  const handleMenuPress = () => {
    // If it's the user's own vent, show delete option first
    const options = isOwnVent
      ? [
          'Delete Post',
          'Report Content',
          'Contact Moderator',
          isBlocked ? 'Unblock User' : 'Block User',
          isHidden ? 'Unhide Post' : 'Hide Post',
          'Cancel',
        ]
      : [
          'Report Content',
          'Contact Moderator',
          isBlocked ? 'Unblock User' : 'Block User',
          isHidden ? 'Unhide Post' : 'Hide Post',
          'Cancel',
        ];
    const cancelButtonIndex = isOwnVent ? 5 : 4;

    if (Platform.OS === 'ios') {
      const destructiveIndices = isOwnVent ? [0, 1, 2] : [0, 1];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex: destructiveIndices,
        },
        (buttonIndex) => {
          if (isOwnVent) {
            if (buttonIndex === 0) {
              handleDeleteVent();
            } else if (buttonIndex === 1) {
              handleReport();
            } else if (buttonIndex === 2) {
              router.push('/moderator-contact');
            } else if (buttonIndex === 3) {
              handleBlockToggle();
            } else if (buttonIndex === 4) {
              handleHideToggle();
            }
          } else {
            if (buttonIndex === 0) {
              handleReport();
            } else if (buttonIndex === 1) {
              router.push('/moderator-contact');
            } else if (buttonIndex === 2) {
              handleBlockToggle();
            } else if (buttonIndex === 3) {
              handleHideToggle();
            }
          }
        }
      );
    } else {
      const alertButtons = isOwnVent
        ? [
            { text: 'Delete Post', onPress: handleDeleteVent, style: 'destructive' as const },
            { text: 'Report Content', onPress: handleReport, style: 'destructive' as const },
            { text: 'Contact Moderator', onPress: () => router.push('/moderator-contact') },
            {
              text: isBlocked ? 'Unblock User' : 'Block User',
              onPress: handleBlockToggle,
              style: isBlocked ? 'default' as const : 'destructive' as const,
            },
            {
              text: isHidden ? 'Unhide Post' : 'Hide Post',
              onPress: handleHideToggle,
            },
            { text: 'Cancel', style: 'cancel' as const },
          ]
        : [
            { text: 'Report Content', onPress: handleReport, style: 'destructive' as const },
            { text: 'Contact Moderator', onPress: () => router.push('/moderator-contact') },
            {
              text: isBlocked ? 'Unblock User' : 'Block User',
              onPress: handleBlockToggle,
              style: isBlocked ? 'default' as const : 'destructive' as const,
            },
            {
              text: isHidden ? 'Unhide Post' : 'Hide Post',
              onPress: handleHideToggle,
            },
            { text: 'Cancel', style: 'cancel' as const },
          ];
      Alert.alert('Post Options', undefined, alertButtons);
    }
  };

  const handleDeleteVent = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Try API first
              try {
                if (deviceId) {
                  await api.deleteVent?.(vent.id, deviceId);
                }
              } catch (apiError) {
                // Silently fallback to local storage
              }
              
              // Delete from local storage
              await storage.deleteVent(vent.id);
              
              // Hide the vent immediately (it will be removed from feed on next refresh)
              await storage.hidePost(vent.id);
              setIsHidden(true);
              
              Alert.alert(
                'Post Deleted',
                'Your post has been removed from the feed.',
                [{ text: 'OK' }]
              );
              
              mixpanelService.track('vent_deleted', {
                ventId: vent.id,
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    const reportReasons = [
      { label: 'Harassment', value: 'harassment' },
      { label: 'Hate Speech', value: 'hate_speech' },
      { label: 'Spam', value: 'spam' },
      { label: 'Inappropriate Content', value: 'inappropriate' },
      { label: 'Other', value: 'other' },
    ];

    if (Platform.OS === 'ios') {
      const options = [...reportReasons.map(r => r.label), 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: [0, 1, 2, 3],
        },
        async (buttonIndex) => {
          if (buttonIndex < reportReasons.length) {
            const selectedReason = reportReasons[buttonIndex];
            await submitReport(selectedReason.value);
          }
        }
      );
    } else {
      Alert.alert(
        'Report Content',
        'Why are you reporting this post?',
        [
          ...reportReasons.map((reason) => ({
            text: reason.label,
            onPress: () => submitReport(reason.value),
            style: 'default' as const,
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  };

  const submitReport = async (reason: 'harassment' | 'hate_speech' | 'spam' | 'inappropriate' | 'other') => {
    try {
      // Try API first
      try {
        const currentDeviceId = deviceId || await getDeviceId();
        if (currentDeviceId) {
          await api.createReport?.({
            ventId: vent.id,
            reason,
            description: `Vent: ${(vent.text || '').substring(0, 100)}`,
            deviceId: currentDeviceId,
          });
        }
      } catch (apiError) {
        // Silently fallback to local storage
      }
      
      const handle = (vent as any).anonymousHandle || vent.handle || 'Anonymous';
      await storage.createReport({
        ventId: vent.id,
        handle: handle,
        reason,
        description: `Vent: ${(vent.text || '').substring(0, 100)}`,
      });
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it within 24 hours and take appropriate action.',
        [{ text: 'OK' }]
      );
      mixpanelService.track('content_reported', {
        ventId: vent.id,
        reason,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const handleBlockToggle = async () => {
    try {
      const handle = (vent as any).anonymousHandle || vent.handle || '';
      if (!handle) {
        Alert.alert('Error', 'Unable to identify user.');
        return;
      }
      
      if (isBlocked) {
        await storage.unblockUser(handle);
        setIsBlocked(false);
        Alert.alert('User Unblocked', 'You will now see posts from this user.');
      } else {
        await storage.blockUser(handle);
        setIsBlocked(true);
        Alert.alert(
          'User Blocked',
          'You will no longer see posts from this user. You can unblock them from Settings.'
        );
      }
      mixpanelService.track(isBlocked ? 'user_unblocked' : 'user_blocked', {
        handle: handle,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Error toggling block:', error);
      }
      Alert.alert('Error', 'Failed to update block status. Please try again.');
    }
  };

  const handleHideToggle = async () => {
    try {
      if (!vent.id) {
        Alert.alert('Error', 'Unable to identify post.');
        return;
      }
      
      if (isHidden) {
        await storage.unhidePost(vent.id);
        setIsHidden(false);
      } else {
        await storage.hidePost(vent.id);
        setIsHidden(true);
        Alert.alert('Post Hidden', 'This post has been hidden from your feed.');
      }
      mixpanelService.track(isHidden ? 'post_unhidden' : 'post_hidden', {
        ventId: vent.id,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('Error toggling hide:', error);
      }
      Alert.alert('Error', 'Failed to update hide status. Please try again.');
    }
  };

  // Don't render if hidden
  if (isHidden) {
    return null;
  }

  // Don't render if user is blocked
  if (isBlocked) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(theme.animation.duration.normal)}
      style={styles.cardWrapper}
    >
      <Card variant="elevated" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.handleContainer}>
            <Text style={styles.icon} numberOfLines={1}>
              {isOwnVent && userIcon ? userIcon : '👤'}
            </Text>
            <Text style={styles.handle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {(vent as any).anonymousHandle || vent.handle || 'Anonymous'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.roomTag}>
              <Text style={styles.roomText}>{vent.room}</Text>
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={handleMenuPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.ventText}>{censorProfanity(vent.text || '')}</Text>

        {/* Calm cards - no aggressive engagement indicators */}
        <View style={styles.reactionsContainer}>
          <ReactionButton
            emoji="💬"
            label="Comment"
            active={false}
            onPress={() => handleReaction('comment')}
            disabled={false}
            showCount={false}
          />
          <ReactionButton
            emoji="🙌"
            label="Support"
            active={reactions.support}
            onPress={() => handleReaction('support')}
            disabled={false}
            showCount={false}
          />
          <ReactionButton
            emoji="🫶"
            label="Empathy"
            active={reactions.empathy}
            onPress={() => handleReaction('empathy')}
            disabled={false}
            showCount={false}
          />
        </View>
      </Card>
    </Animated.View>
  );
};

interface ReactionButtonProps {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  showCount?: boolean; // No aggressive engagement indicators
}

const ReactionButton: React.FC<ReactionButtonProps> = ({
  emoji,
  label,
  active,
  onPress,
  disabled = false,
  showCount = false,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    triggerHapticImpact();
    scale.value = withSpring(SCALE.press, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * (active ? 1.02 : 1) }
    ],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
      style={reactionStyles.button}
      disabled={disabled}
    >
      <Animated.View
        style={[
          reactionStyles.content,
          active && reactionStyles.active,
          disabled && reactionStyles.disabled,
          animatedStyle,
        ]}
      >
        <Text style={reactionStyles.emoji}>{emoji}</Text>
        <Text
          style={[
            reactionStyles.label,
            active && reactionStyles.labelActive,
            disabled && reactionStyles.labelDisabled,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit={false}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.0}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const reactionStyles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 0,
    flexShrink: 0, // Don't shrink buttons - maintain spacing
  },
  content: {
    flexDirection: 'column', // Column layout: emoji on top, text on bottom
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    gap: theme.spacing.xs / 2, // Small gap between emoji and text
    minHeight: 52, // Slightly taller for vertical layout
    flexShrink: 0, // Don't shrink content
  },
  active: {
    backgroundColor: theme.colors.primary.subtle + '80', // More visible active state
    opacity: 1,
  },
  disabled: {
    opacity: 1, // Full opacity - always visible
  },
  emoji: {
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.fontSize.lg * 1.1,
    textAlign: 'center',
  },
  label: {
    fontSize: 9, // Smaller font to fit in buttons
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    letterSpacing: -0.3, // Negative letter spacing for compact text
    numberOfLines: 1,
    fontWeight: theme.typography.fontWeight.medium,
    opacity: 1, // Full opacity
    flexShrink: 1, // Allow text to shrink if needed
    flexWrap: 'wrap', // Allow wrapping if needed
    lineHeight: 11, // Tight line height for compact layout
    marginTop: 2, // Small margin from emoji
    paddingHorizontal: 2, // Small padding to prevent edge overflow
  },
  labelActive: {
    color: theme.colors.primary.main, // Full color when active
    fontWeight: theme.typography.fontWeight.semibold,
  },
  labelDisabled: {
    opacity: 1, // Full opacity
    color: theme.colors.text.primary,
  },
});

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  menuButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  menuIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: theme.typography.fontWeight.bold,
  },
  handleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  icon: {
    fontSize: 18,
    lineHeight: 18,
  },
  handle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  roomTag: {
    backgroundColor: theme.colors.primary.subtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
    alignSelf: 'flex-start',
  },
  roomText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.3,
    textTransform: 'none',
  },
  ventText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.regular,
    fontWeight: theme.typography.fontWeight.regular,
    letterSpacing: 0.1,
  },
  reactionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm, // Proper spacing between buttons
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border.light,
    opacity: 1, // Full opacity - fully visible
    flexWrap: 'nowrap', // Ensure all buttons stay in one line
  },
});
