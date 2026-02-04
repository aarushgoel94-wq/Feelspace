import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, Keyboard, Alert, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { Card } from '~app/components/shared/Card';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { api, Comment, Vent } from '~app/services/api';
import { storage } from '~app/models/storage';
import { sessionManager } from '~app/models/session';
import { getDeviceId } from '~app/utils/deviceId';
import { triggerHapticImpact } from '~app/utils/haptics';
import { moderateContent, censorProfanity, ModerationResult } from '~app/utils/contentModeration';
import { TextInputWithSpeech } from '~app/components/shared/TextInputWithSpeech';
import { ShareVentModal } from '~app/components/shared/ShareVentModal';

export default function VentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vent, setVent] = useState<Vent | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [reactions, setReactions] = useState({
    support: false,
    empathy: false,
  });
  const [reactionCounts, setReactionCounts] = useState({
    support: 0,
    empathy: 0,
  });
  const [commentReactions, setCommentReactions] = useState<Record<string, { support: boolean; empathy: boolean }>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [isOwnVent, setIsOwnVent] = useState(false);
  
  // Refs must be declared before any early returns
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Memoized censored comments - ensures censoring happens before render
  const censoredComments = useMemo(() => {
    return comments.map(comment => {
      const originalText = comment.text || '';
      const censoredText = censorProfanity(originalText);
      // Return new object to ensure React detects the change
      return {
        ...comment,
        text: censoredText,
      };
    });
  }, [comments, renderKey]);

  // Moderate comment as user types
  const [moderationResult, setModerationResult] = useState<ModerationResult>({
    hasIssues: false,
    warnings: [],
    blocked: false,
    issues: {
      phoneNumbers: false,
      emails: false,
      addresses: false,
      mentions: false,
      properNames: false,
      hateSpeech: false,
      threats: false,
      slurs: false,
      profanity: false,
      suicidal: false,
      homicidal: false,
    },
    censoredText: '',
  });

  useEffect(() => {
    const moderate = async () => {
      if (commentText.trim().length === 0) {
        setModerationError(null);
        setModerationResult({
          hasIssues: false,
          warnings: [],
          blocked: false,
          issues: {
            phoneNumbers: false,
            emails: false,
            addresses: false,
            mentions: false,
            properNames: false,
            hateSpeech: false,
            threats: false,
            slurs: false,
            profanity: false,
            suicidal: false,
            homicidal: false,
          },
          censoredText: '',
        });
        return;
      }
      const result = await moderateContent(commentText);
      if (result.blocked) {
        setModerationError(result.warnings[0] || 'Content cannot be posted.');
      } else {
        setModerationError(null);
      }
      setModerationResult(result);
    };
    moderate();
  }, [commentText]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const ventId = Array.isArray(id) ? id[0] : id;
        if (!ventId) return;
        
        const idValue = await getDeviceId();
        setDeviceId(idValue);
        api.setDeviceId(idValue);

        // Load reactions
        const anonymousHandle = sessionManager.getAnonymousHandle();
        try {
          const apiReactions = await api.getReactions(ventId);
          const userReactions = {
            support: apiReactions.some(r => r.type === 'support' && r.anonymousHandle === anonymousHandle),
            empathy: apiReactions.some(r => r.type === 'empathy' && r.anonymousHandle === anonymousHandle),
          };
          setReactions(userReactions);
          
          const counts = await api.getReactionCounts(ventId);
          setReactionCounts({
            support: counts.support || 0,
            empathy: counts.empathy || 0,
          });
        } catch (apiError) {
          // Fallback to local storage
          const localReactions = await storage.getReactionsByVent(ventId);
          const userReactions = {
            support: localReactions.some(r => r.type === 'support' && r.handle === anonymousHandle),
            empathy: localReactions.some(r => r.type === 'empathy' && r.handle === anonymousHandle),
          };
          setReactions(userReactions);
          
          const counts = {
            support: localReactions.filter(r => r.type === 'support').length,
            empathy: localReactions.filter(r => r.type === 'empathy').length,
          };
          setReactionCounts(counts);
        }

        // Try to load from API first (silently fail if no backend)
        try {
          const ventData = await api.getVent(ventId);
          setVent(ventData);
          // Check if this is the user's own vent
          const currentHandle = sessionManager.getAnonymousHandle();
          setIsOwnVent(ventData.anonymousHandle === currentHandle);
          const commentsData = await api.getComments(ventId);
          // Filter blocked users and censor comments
          const blockedUsers = await storage.getBlockedUsers();
          const filteredComments = commentsData.filter(c => 
            !blockedUsers.includes(c.anonymousHandle || '')
          );
          const censoredApiComments = filteredComments.map(c => ({
            ...c,
            text: censorProfanity(c.text || ''),
          }));
          setComments(censoredApiComments);
          
          // Load comment reactions from API
          const commentReactionsMap: Record<string, { support: boolean; empathy: boolean }> = {};
          const anonymousHandle = sessionManager.getAnonymousHandle();
          for (const comment of censoredApiComments) {
            try {
              const commentReactions = await api.getReactions(ventId);
              commentReactionsMap[comment.id] = {
                support: commentReactions.some(r => r.type === 'support' && r.anonymousHandle === anonymousHandle),
                empathy: commentReactions.some(r => r.type === 'empathy' && r.anonymousHandle === anonymousHandle),
              };
            } catch (error) {
              commentReactionsMap[comment.id] = { support: false, empathy: false };
            }
          }
          setCommentReactions(commentReactionsMap);
        } catch (apiError) {
          // Silently fallback to local storage - expected when no backend
          const localVent = await storage.getVent(ventId);
          if (localVent) {
            const ventDate = localVent.createdAt instanceof Date 
              ? localVent.createdAt.toISOString() 
              : localVent.createdAt;
            
            // Handle room - can be string or object
            let ventRoom: { id: string; name: string } | undefined;
            let roomId = '';
            
            if (typeof localVent.room === 'string') {
              roomId = localVent.room;
              ventRoom = { id: localVent.room, name: 'General' };
            } else if (localVent.room && typeof localVent.room === 'object') {
              roomId = (localVent.room as any).id || '';
              ventRoom = { 
                id: (localVent.room as any).id || '', 
                name: (localVent.room as any).name || 'General' 
              };
            } else {
              ventRoom = { id: '', name: 'General' };
            }
            
            const ventData = {
              id: localVent.id,
              roomId: roomId,
              room: ventRoom,
              text: localVent.text,
              anonymousHandle: localVent.handle,
              deviceId: '',
              moodBefore: localVent.moodBefore || 5,
              moodAfter: localVent.moodAfter || 5,
              createdAt: ventDate,
              reflection: null, // Local storage doesn't support reflections
            } as Vent;
            setVent(ventData);
            // Check if this is the user's own vent
            const currentHandle = sessionManager.getAnonymousHandle();
            setIsOwnVent(localVent.handle === currentHandle);
          }
          const localComments = await storage.getCommentsByVent(ventId);
          const blockedUsers = await storage.getBlockedUsers();
          const filteredComments = localComments.filter(c => 
            !blockedUsers.includes(c.handle || '')
          );
          const censoredLocalComments = filteredComments.map(c => ({
            id: c.id,
            ventId: c.ventId,
            text: censorProfanity(c.text || ''), // Always censor when loading from storage
            anonymousHandle: c.handle || 'Anonymous',
            createdAt: c.createdAt.toISOString(),
          }));
          setComments(censoredLocalComments);
          
          // Load comment reactions
          const anonymousHandle = sessionManager.getAnonymousHandle();
          const commentReactionsMap: Record<string, { support: boolean; empathy: boolean }> = {};
          for (const comment of censoredLocalComments) {
            try {
              const commentReactions = await storage.getReactionsByVent(ventId);
              commentReactionsMap[comment.id] = {
                support: commentReactions.some(r => r.type === 'support' && r.handle === anonymousHandle),
                empathy: commentReactions.some(r => r.type === 'empathy' && r.handle === anonymousHandle),
              };
            } catch (error) {
              commentReactionsMap[comment.id] = { support: false, empathy: false };
            }
          }
          setCommentReactions(commentReactionsMap);
        }
          } catch (error) {
            if (__DEV__) {
              console.error('Error loading vent:', error);
            }
          } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  const handleCommentMenuPress = (comment: Comment) => {
    const options = [
      'Report Comment',
      'Block User',
      'Delete Comment',
      'Cancel',
    ];
    const cancelButtonIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex: [2],
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleReportComment(comment);
          } else if (buttonIndex === 1) {
            handleBlockCommentUser(comment);
          } else if (buttonIndex === 2) {
            handleDeleteComment(comment);
          }
        }
      );
    } else {
      Alert.alert(
        'Comment Options',
        undefined,
        [
          { text: 'Report Comment', onPress: () => handleReportComment(comment), style: 'destructive' },
          { text: 'Block User', onPress: () => handleBlockCommentUser(comment) },
          { text: 'Delete Comment', onPress: () => handleDeleteComment(comment), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleReportVent = async () => {
    try {
      const ventId = Array.isArray(id) ? id[0] : id;
      if (!ventId || !vent) return;

      Alert.prompt(
        'Report Post',
        'Why are you reporting this post?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: (reason) => {
              // Show success immediately - before any async operations
              try {
                Alert.alert(
                  'Report Submitted',
                  'Thank you for your report. We will review it within 24 hours and take appropriate action.',
                  [{ text: 'OK' }]
                );
              } catch (alertError) {
                // If alert fails, silently continue - user already submitted
              }

              // Process report in background (completely non-blocking and silent)
              // Use setTimeout to ensure it's truly async and doesn't block
              setTimeout(() => {
                (async () => {
                  try {
                    if (!reason || !reason.trim()) {
                      return; // No reason provided, silently exit
                    }

                    // Save to local storage first (silently fail if it doesn't work)
                    try {
                      await storage.createReport({
                        ventId: ventId,
                        handle: vent.anonymousHandle || 'Anonymous',
                        reason: reason.trim(),
                        description: `Vent: ${vent.text?.substring(0, 100) || ''}`,
                      });
                    } catch (storageError) {
                      // Completely silent - no logging, no errors
                    }

                    // Also send to backend API if available (completely silent)
                    if (deviceId) {
                      try {
                        // Map reason to backend format
                        let backendReason = 'other';
                        const reasonLower = reason.toLowerCase();
                        if (reasonLower.includes('harassment')) {
                          backendReason = 'harassment';
                        } else if (reasonLower.includes('hate') || reasonLower.includes('speech')) {
                          backendReason = 'hate_speech';
                        } else if (reasonLower.includes('spam')) {
                          backendReason = 'spam';
                        } else if (reasonLower.includes('inappropriate')) {
                          backendReason = 'inappropriate';
                        }

                        // Send to backend (fire and forget - never throws errors)
                        api.createReport({
                          ventId: ventId,
                          reason: backendReason as 'harassment' | 'hate_speech' | 'spam' | 'inappropriate' | 'other',
                          description: `Vent Report: ${reason.trim()}\n\nVent: ${vent.text?.substring(0, 200) || ''}`,
                          deviceId,
                        }).catch(() => {
                          // Completely silent - no logging, no errors, no user feedback
                        });
                      } catch (apiError) {
                        // Completely silent - no logging, no errors
                      }
                    }
                  } catch (error) {
                    // Completely silent - user already saw success message
                    // No logging, no errors, no user feedback
                  }
                })();
              }, 0);
            },
          },
        ],
        'plain-text'
      );
    } catch (error) {
      // If prompt fails, silently handle - don't show any error to user
    }
  };

  const handleReportComment = async (comment: Comment) => {
    try {
      Alert.prompt(
        'Report Comment',
        'Why are you reporting this comment?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: (reason) => {
              // Show success immediately - before any async operations
              try {
                Alert.alert(
                  'Report Submitted',
                  'Thank you for your report. We will review it within 24 hours and take appropriate action.',
                  [{ text: 'OK' }]
                );
              } catch (alertError) {
                // If alert fails, silently continue - user already submitted
              }

              // Process report in background (completely non-blocking and silent)
              // Use setTimeout to ensure it's truly async and doesn't block
              setTimeout(() => {
                (async () => {
                  try {
                    if (!reason || !reason.trim()) {
                      return; // No reason provided, silently exit
                    }

                    // Save to local storage first (silently fail if it doesn't work)
                    try {
                      await storage.createReport({
                        ventId: comment.ventId,
                        handle: comment.anonymousHandle || 'Anonymous',
                        reason: reason.trim(),
                        description: `Comment: ${comment.text?.substring(0, 100) || ''}`,
                      });
                    } catch (storageError) {
                      // Completely silent - no logging, no errors
                    }

                    // Also send to backend API if available (completely silent)
                    if (deviceId) {
                      try {
                        // Map reason to backend format
                        let backendReason = 'other';
                        const reasonLower = reason.toLowerCase();
                        if (reasonLower.includes('harassment')) {
                          backendReason = 'harassment';
                        } else if (reasonLower.includes('hate') || reasonLower.includes('speech')) {
                          backendReason = 'hate_speech';
                        } else if (reasonLower.includes('spam')) {
                          backendReason = 'spam';
                        } else if (reasonLower.includes('inappropriate')) {
                          backendReason = 'inappropriate';
                        }

                        // Send to backend (fire and forget - never throws errors)
                        api.createReport({
                          ventId: comment.ventId,
                          reason: backendReason as 'harassment' | 'hate_speech' | 'spam' | 'inappropriate' | 'other',
                          description: `Comment Report: ${reason.trim()}\n\nComment: ${comment.text?.substring(0, 100) || ''}`,
                          deviceId,
                        }).catch(() => {
                          // Completely silent - no logging, no errors, no user feedback
                        });
                      } catch (apiError) {
                        // Completely silent - no logging, no errors
                      }
                    }
                  } catch (error) {
                    // Completely silent - user already saw success message
                    // No logging, no errors, no user feedback
                  }
                })();
              }, 0);
            },
          },
        ],
        'plain-text'
      );
    } catch (error) {
      // If prompt fails, silently handle - don't show any error to user
    }
  };

  const handleDeleteVent = async () => {
    const ventId = Array.isArray(id) ? id[0] : id;
    if (!ventId || !vent) return;

    if (!isDeveloper) {
      Alert.alert('Access Denied', 'Only developers can delete vents.');
      return;
    }

    Alert.alert(
      'Delete Vent',
      'Are you sure you want to permanently delete this vent? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHapticImpact();
              
              // Delete from backend if available
              if (deviceId) {
                try {
                  await api.deleteVent(ventId, deviceId);
                } catch (apiError) {
                  // Continue with local deletion even if API fails
                  if (__DEV__) {
                    console.warn('Failed to delete vent from backend:', apiError);
                  }
                }
              }

              // Delete from local storage
              await storage.deleteVent(ventId);
              
              // Delete associated comments
              const comments = await storage.getCommentsByVent(ventId);
              for (const comment of comments) {
                await storage.deleteComment(comment.id);
              }
              
              // Delete associated reactions
              const reactions = await storage.getReactionsByVent(ventId);
              for (const reaction of reactions) {
                await storage.deleteReaction(reaction.id);
              }
              
              // Delete associated reflection
              await storage.deleteReflection(ventId);
              
              // Delete associated reports
              const reports = await storage.getReports();
              const ventReports = reports.filter(r => r.ventId === ventId);
              for (const report of ventReports) {
                await storage.deleteReport(report.id);
              }

              Alert.alert('Success', 'Vent has been permanently deleted.');
              router.back();
            } catch (error) {
              if (__DEV__) {
                console.error('Error deleting vent:', error);
              }
              Alert.alert('Error', 'Failed to delete vent. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBlockCommentUser = async (comment: Comment) => {
    try {
      await storage.blockUser(comment.anonymousHandle || '');
      Alert.alert(
        'User Blocked',
        'You will no longer see comments from this user.'
      );
      // Reload comments to filter out blocked user
      const ventId = Array.isArray(id) ? id[0] : id;
      if (ventId) {
        const loadComments = async () => {
          try {
            // Try API first
            try {
              const commentsData = await api.getComments(ventId);
              const blockedUsers = await storage.getBlockedUsers();
              const filteredComments = commentsData.filter(c => 
                !blockedUsers.includes(c.anonymousHandle || '')
              );
              const censoredComments = filteredComments.map(c => ({
                ...c,
                text: censorProfanity(c.text || ''),
              }));
              setComments(censoredComments);
            } catch (apiError) {
              // Fallback to local storage
              const localComments = await storage.getCommentsByVent(ventId);
              const blockedUsers = await storage.getBlockedUsers();
              const filteredComments = localComments.filter(c => 
                !blockedUsers.includes(c.handle || '')
              );
              const censoredComments = filteredComments.map(c => ({
                id: c.id,
                ventId: c.ventId,
                text: censorProfanity(c.text || ''),
                anonymousHandle: c.handle || 'Anonymous',
                createdAt: c.createdAt.toISOString(),
              }));
              setComments(censoredComments);
            }
          } catch (error) {
            console.error('Error loading comments:', error);
          }
        };
        await loadComments();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const ventId = Array.isArray(id) ? id[0] : id;
              if (!ventId) return;

              // Remove from state immediately
              setComments(prev => prev.filter(c => c.id !== comment.id));
              setRenderKey(prev => prev + 1);

              // Try API first
              try {
                if (deviceId && api.deleteComment) {
                  await api.deleteComment(comment.id, deviceId);
                }
              } catch (apiError) {
                // Fallback to local storage
                await storage.deleteComment(comment.id);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete comment. Please try again.');
              // Reload comments on error
              const ventId = Array.isArray(id) ? id[0] : id;
              if (ventId) {
                try {
                  const commentsData = await api.getComments(ventId).catch(() => null);
                  if (commentsData) {
                    const blockedUsers = await storage.getBlockedUsers();
                    const filteredComments = commentsData.filter(c => 
                      !blockedUsers.includes(c.anonymousHandle || '')
                    );
                    const censoredComments = filteredComments.map(c => ({
                      ...c,
                      text: censorProfanity(c.text || ''),
                    }));
                    setComments(censoredComments);
                  } else {
                    const localComments = await storage.getCommentsByVent(ventId);
                    const blockedUsers = await storage.getBlockedUsers();
                    const filteredComments = localComments.filter(c => 
                      !blockedUsers.includes(c.handle || '')
                    );
                    const censoredComments = filteredComments.map(c => ({
                      id: c.id,
                      ventId: c.ventId,
                      text: censorProfanity(c.text || ''),
                      anonymousHandle: c.handle || 'Anonymous',
                      createdAt: c.createdAt.toISOString(),
                    }));
                    setComments(censoredComments);
                  }
                } catch (reloadError) {
                  console.error('Error reloading comments:', reloadError);
                }
              }
            }
          },
        },
      ]
    );
  };

  const handleSubmitComment = useCallback(async () => {
    // Handle id as array or string
    const ventId = Array.isArray(id) ? id[0] : id;
    if (!commentText.trim() || !ventId || !deviceId) return;

    // Check moderation - block if slurs, PII, hate speech, or threats
    if (moderationResult.blocked) {
      setModerationError(moderationResult.warnings[0] || 'This comment cannot be posted.');
      return;
    }

    setSubmitting(true);
    setModerationError(null);

    // Always censor profanity before saving
    const rawText = commentText.trim();
    const censoredText = censorProfanity(rawText);
    
    const newComment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      ventId: ventId,
      text: censoredText, // Save censored version
      anonymousHandle: sessionManager.getAnonymousHandle(),
      createdAt: new Date().toISOString(),
    };

    const commentForState = {
      ...newComment,
      text: censoredText, // Use censored version in state
    };
    
    // Clear input immediately for better UX
    setCommentText('');
    
    // Force React update by creating new array
    setComments(prev => {
      const updated = [...prev, commentForState];
      return updated;
    });
    
    // Force re-render
    setRenderKey(prev => prev + 1);
    
    // Dismiss keyboard after submitting
    Keyboard.dismiss();
    
    // Scroll to bottom to show new comment after a short delay
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Always save to local storage first for offline support
      await storage.createComment({
        ventId: ventId,
        text: censoredText,
        anonymousHandle: newComment.anonymousHandle,
      });

      // Try to sync with backend (queue if offline)
      try {
        const { offlineSync } = await import('~app/services/offlineSync');
        const isOnline = offlineSync.getIsOnline();
        
        if (isOnline) {
          // Try API immediately if online
          try {
            await api.createComment({
              ventId: ventId,
              text: censoredText,
              anonymousHandle: newComment.anonymousHandle,
              deviceId,
            });
          } catch (apiError) {
            // Queue for sync later if API fails
            await offlineSync.queueAction('comment', 'create', {
              ventId: ventId,
              text: censoredText,
              anonymousHandle: newComment.anonymousHandle,
              deviceId,
            });
          }
        } else {
          // Queue for sync when online
          await offlineSync.queueAction('comment', 'create', {
            ventId: ventId,
            text: censoredText,
            anonymousHandle: newComment.anonymousHandle,
            deviceId,
          });
        }
      } catch (syncError) {
        // Silently fail - comment is already saved locally
        if (__DEV__) {
          console.warn('Failed to queue comment for sync:', syncError);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error creating comment:', error);
      }
      setModerationError('Failed to post comment. Please try again.');
      // Revert optimistic update
      setComments(prev => prev.filter(c => c.id !== newComment.id));
      // Restore comment text on error
      setCommentText(rawText);
    } finally {
      setSubmitting(false);
    }
  }, [commentText, id, deviceId, moderationResult]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!vent) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Vent not found</Text>
        <PrimaryButton title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        {isDeveloper && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteVent()}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
      >
        <Card variant="elevated" style={styles.ventCard}>
          <View style={styles.ventHeader}>
            <View style={styles.handleContainer}>
              <Text style={styles.handleLabel}>Anonymous</Text>
              <Text style={styles.handle}>{vent.anonymousHandle || 'Anonymous'}</Text>
            </View>
            <View style={styles.ventHeaderRight}>
              {vent.room && (
                <View style={styles.roomTag}>
                  <Text style={styles.roomText}>{vent.room.name}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => handleReportVent()}
                activeOpacity={0.7}
              >
                <Text style={styles.reportButtonText}>⚠️</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.ventText}>{censorProfanity(vent.text || '')}</Text>
          
          {/* Emotional Reflection */}
          {vent.reflection && (
            <View style={styles.reflectionContainer}>
              <Text style={styles.reflectionLabel}>What we heard</Text>
              <Text style={styles.reflectionText}>{vent.reflection}</Text>
            </View>
          )}
          
          <View style={styles.reactionsContainer}>
            <TouchableOpacity
              style={[styles.reactionButton, reactions.support && styles.reactionButtonActive]}
              onPress={async () => {
                const wasActive = reactions.support;
                const previousCount = reactionCounts.support;

                // Optimistic update
                setReactions(prev => ({ ...prev, support: !prev.support }));
                setReactionCounts(prev => ({
                  ...prev,
                  support: wasActive ? prev.support - 1 : prev.support + 1,
                }));

                try {
                  const ventId = Array.isArray(id) ? id[0] : id;
                  if (!ventId) return;
                  
                  const anonymousHandle = sessionManager.getAnonymousHandle();
                  if (deviceId) {
                    try {
                      await api.createReaction({
                        ventId: ventId,
                        type: 'support',
                        anonymousHandle,
                        deviceId,
                      });
                    } catch (apiError) {
                      // Fallback to local storage
                      if (wasActive) {
                        const localReactions = await storage.getReactionsByVent(ventId);
                        const userReaction = localReactions.find(
                          r => r.type === 'support' && r.handle === anonymousHandle
                        );
                        if (userReaction) {
                          await storage.deleteReaction(userReaction.id);
                        }
                      } else {
                        await storage.createReaction({
                          ventId: ventId,
                          type: 'support',
                          anonymousHandle,
                        });
                      }
                    }
                  } else {
                    // No device ID - use local storage only
                    if (wasActive) {
                      const localReactions = await storage.getReactionsByVent(ventId);
                      const userReaction = localReactions.find(
                        r => r.type === 'support' && r.handle === anonymousHandle
                      );
                      if (userReaction) {
                        await storage.deleteReaction(userReaction.id);
                      }
                    } else {
                      await storage.createReaction({
                        ventId: ventId,
                        type: 'support',
                        anonymousHandle,
                      });
                    }
                  }
                } catch (error) {
                  // Revert optimistic update on error
                  setReactions(prev => ({ ...prev, support: wasActive }));
                  setReactionCounts(prev => ({ ...prev, support: previousCount }));
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>🙌</Text>
              <Text style={[styles.reactionLabel, reactions.support && styles.reactionLabelActive]}>
                Support
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.reactionButton, reactions.empathy && styles.reactionButtonActive]}
              onPress={async () => {
                const wasActive = reactions.empathy;
                const previousCount = reactionCounts.empathy;

                // Optimistic update
                setReactions(prev => ({ ...prev, empathy: !prev.empathy }));
                setReactionCounts(prev => ({
                  ...prev,
                  empathy: wasActive ? prev.empathy - 1 : prev.empathy + 1,
                }));

                try {
                  const ventId = Array.isArray(id) ? id[0] : id;
                  if (!ventId) return;
                  
                  const anonymousHandle = sessionManager.getAnonymousHandle();
                  if (deviceId) {
                    try {
                      await api.createReaction({
                        ventId: ventId,
                        type: 'empathy',
                        anonymousHandle,
                        deviceId,
                      });
                    } catch (apiError) {
                      // Fallback to local storage
                      if (wasActive) {
                        const localReactions = await storage.getReactionsByVent(ventId);
                        const userReaction = localReactions.find(
                          r => r.type === 'empathy' && r.handle === anonymousHandle
                        );
                        if (userReaction) {
                          await storage.deleteReaction(userReaction.id);
                        }
                      } else {
                        await storage.createReaction({
                          ventId: ventId,
                          type: 'empathy',
                          anonymousHandle,
                        });
                      }
                    }
                  } else {
                    // No device ID - use local storage only
                    if (wasActive) {
                      const localReactions = await storage.getReactionsByVent(ventId);
                      const userReaction = localReactions.find(
                        r => r.type === 'empathy' && r.handle === anonymousHandle
                      );
                      if (userReaction) {
                        await storage.deleteReaction(userReaction.id);
                      }
                    } else {
                      await storage.createReaction({
                        ventId: ventId,
                        type: 'empathy',
                        anonymousHandle,
                      });
                    }
                  }
                } catch (error) {
                  // Revert optimistic update on error
                  setReactions(prev => ({ ...prev, empathy: wasActive }));
                  setReactionCounts(prev => ({ ...prev, empathy: previousCount }));
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>🫶</Text>
              <Text style={[styles.reactionLabel, reactions.empathy && styles.reactionLabelActive]}>
                Empathy
              </Text>
            </TouchableOpacity>
            
            {/* Share button - only show for the user's own vent */}
            {isOwnVent && (
              <TouchableOpacity
                style={styles.reactionButton}
                onPress={() => setShowShareModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>📤</Text>
                <Text style={styles.reactionLabel}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({censoredComments.length})
          </Text>

          {censoredComments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>
                No comments yet. Be the first to share support!
              </Text>
            </View>
          ) : (
            censoredComments.map((comment, index) => {
              const commentReactionState = commentReactions[comment.id] || { support: false, empathy: false };
              
              return (
              <Animated.View
                key={`${comment.id}-${renderKey}`}
                entering={FadeInDown.delay(index * 50)}
                style={styles.commentWrapper}
              >
                  <Card variant="elevated" style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                      <Text style={styles.commentHandle} numberOfLines={1}>{comment.anonymousHandle}</Text>
                      <View style={styles.commentHeaderRight}>
                        <Text style={styles.commentTime} numberOfLines={1}>
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </Text>
                        <TouchableOpacity
                          style={styles.commentMenuButton}
                          onPress={() => handleCommentMenuPress(comment)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.commentMenuIcon}>⋯</Text>
                        </TouchableOpacity>
                      </View>
                  </View>
                  <Text style={styles.commentText}>
                    {censorProfanity(comment.text || '')}
                  </Text>
                    <View style={styles.commentReactions}>
                      <TouchableOpacity
                        style={[styles.commentReactionButton, commentReactionState.support && styles.commentReactionButtonActive]}
                        onPress={async () => {
                          const ventId = Array.isArray(id) ? id[0] : id;
                          if (!ventId) return;
                          
                          const wasActive = commentReactionState.support;
                          const anonymousHandle = sessionManager.getAnonymousHandle();
                          
                          // Optimistic update
                          setCommentReactions(prev => ({
                            ...prev,
                            [comment.id]: {
                              ...(prev[comment.id] || { support: false, empathy: false }),
                              support: !wasActive,
                            },
                          }));
                          
                          try {
                            if (deviceId) {
                              try {
                                await api.createReaction({
                                  ventId: ventId,
                                  type: 'support',
                                  anonymousHandle,
                                  deviceId,
                                });
                              } catch (apiError) {
                                // Fallback to local storage
                                if (wasActive) {
                                  const localReactions = await storage.getReactionsByVent(ventId);
                                  const userReaction = localReactions.find(
                                    r => r.type === 'support' && r.handle === anonymousHandle
                                  );
                                  if (userReaction) {
                                    await storage.deleteReaction(userReaction.id);
                                  }
                                } else {
                                  await storage.createReaction({
                                    ventId: ventId,
                                    type: 'support',
                                    anonymousHandle,
                                  });
                                }
                              }
                            } else {
                              // No device ID - use local storage only
                              if (wasActive) {
                                const localReactions = await storage.getReactionsByVent(ventId);
                                const userReaction = localReactions.find(
                                  r => r.type === 'support' && r.handle === anonymousHandle
                                );
                                if (userReaction) {
                                  await storage.deleteReaction(userReaction.id);
                                }
                              } else {
                                await storage.createReaction({
                                  ventId: ventId,
                                  type: 'support',
                                  anonymousHandle,
                                });
                              }
                            }
                          } catch (error) {
                            // Revert optimistic update on error
                            setCommentReactions(prev => ({
                              ...prev,
                              [comment.id]: {
                                ...(prev[comment.id] || { support: false, empathy: false }),
                                support: wasActive,
                              },
                            }));
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.commentReactionEmoji}>🙌</Text>
                        <Text style={[styles.commentReactionLabel, commentReactionState.support && styles.commentReactionLabelActive]} numberOfLines={1}>
                          Support
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.commentReactionButton, commentReactionState.empathy && styles.commentReactionButtonActive]}
                        onPress={async () => {
                          const ventId = Array.isArray(id) ? id[0] : id;
                          if (!ventId) return;
                          
                          const wasActive = commentReactionState.empathy;
                          const anonymousHandle = sessionManager.getAnonymousHandle();
                          
                          // Optimistic update
                          setCommentReactions(prev => ({
                            ...prev,
                            [comment.id]: {
                              ...(prev[comment.id] || { support: false, empathy: false }),
                              empathy: !wasActive,
                            },
                          }));
                          
                          try {
                            if (deviceId) {
                              try {
                                await api.createReaction({
                                  ventId: ventId,
                                  type: 'empathy',
                                  anonymousHandle,
                                  deviceId,
                                });
                              } catch (apiError) {
                                // Fallback to local storage
                                if (wasActive) {
                                  const localReactions = await storage.getReactionsByVent(ventId);
                                  const userReaction = localReactions.find(
                                    r => r.type === 'empathy' && r.handle === anonymousHandle
                                  );
                                  if (userReaction) {
                                    await storage.deleteReaction(userReaction.id);
                                  }
                                } else {
                                  await storage.createReaction({
                                    ventId: ventId,
                                    type: 'empathy',
                                    anonymousHandle,
                                  });
                                }
                              }
                            } else {
                              // No device ID - use local storage only
                              if (wasActive) {
                                const localReactions = await storage.getReactionsByVent(ventId);
                                const userReaction = localReactions.find(
                                  r => r.type === 'empathy' && r.handle === anonymousHandle
                                );
                                if (userReaction) {
                                  await storage.deleteReaction(userReaction.id);
                                }
                              } else {
                                await storage.createReaction({
                                  ventId: ventId,
                                  type: 'empathy',
                                  anonymousHandle,
                                });
                              }
                            }
                          } catch (error) {
                            // Revert optimistic update on error
                            setCommentReactions(prev => ({
                              ...prev,
                              [comment.id]: {
                                ...(prev[comment.id] || { support: false, empathy: false }),
                                empathy: wasActive,
                              },
                            }));
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.commentReactionEmoji}>🫶</Text>
                        <Text style={[styles.commentReactionLabel, commentReactionState.empathy && styles.commentReactionLabelActive]} numberOfLines={1}>
                          Empathy
                        </Text>
                      </TouchableOpacity>
                    </View>
                </Card>
              </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, theme.spacing.xs) : theme.spacing.xs }]}>
        {moderationError && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>{moderationError}</Text>
          </View>
        )}
        {moderationResult.hasIssues && !moderationResult.blocked && moderationResult.issues.profanity && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Profanity will be censored in your comment.
            </Text>
          </View>
        )}
        <View style={styles.inputWrapper}>
          <TextInputWithSpeech
              style={[
                styles.input,
                moderationResult.blocked && styles.inputBlocked,
              ]}
              containerStyle={styles.inputContainerStyle}
              placeholder="Write a supportive comment..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={commentText}
              onChangeText={(text) => {
                // REAL-TIME CENSORING: Censor profanity as user types
                const censored = censorProfanity(text);
                setCommentText(censored);
                // Clear error when user starts typing again
                if (moderationError) {
                  setModerationError(null);
                }
              }}
              multiline
              maxLength={500}
              editable={!submitting}
              showSpeechButton={true}
              returnKeyType="default"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // Allow submitting with return key if text is valid
                if (commentText.trim() && !submitting && !moderationResult.blocked) {
                  handleSubmitComment();
                }
              }}
            />
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!commentText.trim() || submitting || moderationResult.blocked) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting || moderationResult.blocked}
            activeOpacity={0.7}
          >
            {submitting ? (
              <Text style={styles.submitButtonText}>...</Text>
            ) : (
              <Text
                style={[
                  styles.submitButtonText,
                  (!commentText.trim() || submitting) && styles.submitButtonTextDisabled,
                ]}
              >
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>

      {/* Share Modal */}
      <ShareVentModal
        visible={showShareModal}
        vent={vent}
        showReflection={!!vent?.reflection}
        onClose={() => setShowShareModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 0, // No top padding
    paddingBottom: 0, // No bottom padding
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border.light,
    ...theme.shadows.small,
    minHeight: 44, // Minimum touch target
  },
  backButton: {
    padding: theme.spacing.xs / 2, // Minimal padding
    marginRight: theme.spacing.xs / 2, // Minimal margin
    minHeight: 44, // Minimum touch target
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.medium,
  },
  deleteButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.state.error + '15',
  },
  deleteButtonText: {
    fontSize: theme.typography.fontSize.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 0, // No top padding
    paddingBottom: 100, // Extra padding for input area
  },
  loadingText: {
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
    color: theme.colors.text.secondary,
  },
  errorText: {
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
    color: theme.colors.state.error,
  },
  ventCard: {
    marginBottom: theme.spacing.md,
    marginTop: 0, // No top margin
  },
  ventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  handleContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  handleLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.xs / 2,
    fontFamily: theme.typography.fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  handle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.2,
  },
  ventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  roomTag: {
    backgroundColor: theme.colors.primary.subtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
  },
  roomText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  reportButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.state.warning + '15',
  },
  reportButtonText: {
    fontSize: theme.typography.fontSize.base,
  },
  ventText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    letterSpacing: 0.1,
    marginBottom: theme.spacing.md,
  },
  reactionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border.light,
    flexWrap: 'nowrap',
  },
  reactionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    minHeight: 52,
    gap: theme.spacing.xs / 2,
  },
  reactionButtonActive: {
    backgroundColor: theme.colors.primary.subtle + '80',
    opacity: 1,
  },
  reactionEmoji: {
    fontSize: 20,
    lineHeight: 22,
    textAlign: 'center',
  },
  reactionLabel: {
    fontSize: 10,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    letterSpacing: -0.2,
    numberOfLines: 1,
    fontWeight: theme.typography.fontWeight.medium,
    opacity: 1,
    flexShrink: 0,
    lineHeight: 12,
    marginTop: 2,
  },
  reactionLabelActive: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  commentsSection: {
    marginTop: theme.spacing.lg,
  },
  commentsTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: -0.3,
  },
  emptyComments: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xs,
  },
  emptyCommentsText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
  commentWrapper: {
    marginBottom: theme.spacing.md,
  },
  commentCard: {
    padding: theme.spacing.md,
    marginBottom: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  commentHandle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.1,
    flex: 1,
  },
  commentTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  commentMenuButton: {
    padding: theme.spacing.xs,
  },
  commentMenuIcon: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: theme.typography.fontWeight.bold,
  },
  commentText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    letterSpacing: 0.1,
    marginBottom: theme.spacing.sm,
  },
  commentReactions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border.light,
    flexWrap: 'nowrap',
  },
  commentReactionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    minHeight: 52,
    gap: theme.spacing.xs / 2,
  },
  commentReactionButtonActive: {
    backgroundColor: theme.colors.primary.subtle + '80',
    opacity: 1,
  },
  commentReactionEmoji: {
    fontSize: 20,
    lineHeight: 22,
    textAlign: 'center',
  },
  commentReactionLabel: {
    fontSize: 10,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'center',
    letterSpacing: -0.2,
    numberOfLines: 1,
    fontWeight: theme.typography.fontWeight.medium,
    opacity: 1,
    flexShrink: 0,
    lineHeight: 12,
    marginTop: 2,
  },
  commentReactionLabelActive: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  inputContainer: {
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    paddingTop: theme.spacing.xs / 2, // Minimal top padding
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: 0, // No bottom padding - let safe area handle it
    ...theme.shadows.medium,
    zIndex: 10, // Ensure it's above scroll content
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.xs, // Smaller gap to maximize space
    width: '100%', // Ensure full width
    paddingHorizontal: 0, // No extra padding
  },
  inputContainerStyle: {
    flex: 1, // Take most of the space - this makes the text box wider
    minWidth: 0, // Allow flex to work
    width: '100%',
  },
  input: {
    width: '100%', // Explicit width
    minHeight: 44, // Minimum touch target - override TextInputWithSpeech default
    maxHeight: 100, // Reduced max height - override TextInputWithSpeech default
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingRight: 48, // Space for speech button at bottom
    paddingBottom: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.normal,
    textAlignVertical: 'top', // Start text at top for multiline
  },
  submitButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.md,
    width: 65, // Fixed width to ensure it's always visible
    minHeight: 44, // Match input min height
    maxHeight: 44, // Match input min height for alignment
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.small,
    flexShrink: 0, // Never shrink
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.border.light,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  submitButtonTextDisabled: {
    color: theme.colors.text.tertiary,
  },
  warningContainer: {
    backgroundColor: theme.colors.state.error + '15',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.state.error,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  warningText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.state.error,
    fontFamily: theme.typography.fontFamily.regular,
  },
  infoContainer: {
    backgroundColor: theme.colors.state.info + '15',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.state.info,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.state.info,
    fontFamily: theme.typography.fontFamily.regular,
  },
  crisisSupportContainer: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.state.error + '20',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.state.error,
  },
  crisisSupportTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.state.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  crisisSupportText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  inputBlocked: {
    borderColor: theme.colors.state.error,
    backgroundColor: theme.colors.state.error + '08',
  },
  reflectionContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary.subtle,
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary.main,
  },
  reflectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reflectionText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
  },
});
