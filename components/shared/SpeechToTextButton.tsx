import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, ActivityIndicator, Platform, Alert } from 'react-native';
import { theme } from '~app/theme';
import { triggerHapticImpact } from '~app/utils/haptics';

// Import expo-av directly - it's included in package.json and app.json plugins
// For production builds (TestFlight), expo-av will be available as a native module
import * as AudioModule from 'expo-av';

interface SpeechToTextButtonProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  style?: any;
}

export const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({
  onTranscript,
  onError,
  disabled = false,
  style,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recordingRef = useRef<any>(null);
  const animationValue = useRef(new Animated.Value(0)).current;
  const sessionIdRef = useRef<string | null>(null);
  const transcriptPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Always try to initialize Web Speech API (works in web and some native webviews)
    // This works in iOS Safari and can work in webviews
    initializeWebSpeechRecognition();
    
    return () => {
      // Cleanup on unmount
      stopListening();
      if (transcriptPollIntervalRef.current) {
        clearInterval(transcriptPollIntervalRef.current);
      }
    };
  }, []);

  const requestAudioPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        return true; // Web doesn't need explicit permission request (handled by browser)
      }

      // AudioModule is imported directly - should always be available in production builds
      // Ensure Audio module is available
      if (!AudioModule || !AudioModule.getPermissionsAsync || !AudioModule.requestPermissionsAsync) {
        if (__DEV__) {
          console.warn('expo-av module methods not available');
        }
        return false; // Will fall back to Web Speech API
      }

      // First check current permission status
      let currentPermissions;
      try {
        currentPermissions = await AudioModule.getPermissionsAsync();
      } catch (permError: any) {
        console.error('Error getting audio permissions:', permError);
        const errorMsg = 'Unable to check microphone permissions. Please ensure the app has microphone access in Settings.';
        if (onError) {
          onError(errorMsg);
        } else {
          Alert.alert('Microphone Permission', errorMsg);
        }
        return false;
      }
      
      if (currentPermissions.status === 'granted' || currentPermissions.granted) {
        // Already granted, set audio mode
        try {
          await AudioModule.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        } catch (modeError) {
          console.error('Error setting audio mode:', modeError);
          // Continue anyway - permission is granted
        }
        return true;
      }
      
      // Request microphone permissions - this will show iOS permission dialog
      let permissionResult;
      try {
        permissionResult = await AudioModule.requestPermissionsAsync();
      } catch (requestError: any) {
        console.error('Error requesting audio permissions:', requestError);
        const errorMsg = 'Unable to request microphone permission. Please enable it in Settings > Privacy & Security > Microphone > Feelspace';
        if (onError) {
          onError(errorMsg);
        } else {
          Alert.alert(
            'Microphone Permission Required',
            errorMsg,
            [{ text: 'OK' }]
          );
        }
        return false;
      }
      
      const { status, canAskAgain } = permissionResult;
      
      if (status === 'granted') {
        // Set audio mode for recording
        try {
          await AudioModule.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        } catch (modeError) {
          console.error('Error setting audio mode:', modeError);
          // Continue anyway - permission is granted
        }
        return true;
      } else if (status === 'undetermined') {
        // Permission not determined - this shouldn't happen after request, but handle it
        const errorMsg = 'Microphone permission status is undetermined. Please try again.';
        if (onError) {
          onError(errorMsg);
        } else {
          Alert.alert('Microphone Permission', errorMsg);
        }
        return false;
      } else {
        // Permission denied or restricted
        const errorMsg = Platform.OS === 'ios'
          ? 'Microphone access is required for speech-to-text. Please enable it in:\n\nSettings > Privacy & Security > Microphone > Feelspace'
          : 'Microphone access is required. Please enable it in your device settings.';
        
        if (onError) {
          onError(errorMsg);
        } else {
          Alert.alert(
            'Microphone Permission Required',
            errorMsg,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'OK' }
            ]
          );
        }
        return false;
      }
    } catch (error: any) {
      console.error('Error requesting audio permissions:', error);
      const errorMsg = error?.message || 'Failed to request microphone permission. Please check your device settings.';
      if (onError) {
        onError(errorMsg);
      } else {
        Alert.alert('Microphone Access', errorMsg);
      }
      return false;
    }
  };

  const initializeWebSpeechRecognition = () => {
    try {
      // Check if we're in any environment with window object (web, webview, etc.)
      if (typeof window !== 'undefined') {
        // Check for Web Speech API support
        const hasWebkitSpeech = 'webkitSpeechRecognition' in window;
        const hasSpeech = 'SpeechRecognition' in window;
        
        if (hasWebkitSpeech || hasSpeech) {
          const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
          
          try {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
              let interimTranscript = '';
              let finalTranscript = '';

              for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                  finalTranscript += transcript + ' ';
                } else {
                  interimTranscript += transcript;
                }
              }

              // Send final transcript with space for proper word separation
              if (finalTranscript) {
                onTranscript(finalTranscript); // Keep the space at the end
              } 
              // Send interim transcript for real-time feedback
              if (interimTranscript) {
                onTranscript(interimTranscript);
              }
            };

            recognitionRef.current.onerror = (event: any) => {
              console.error('Speech recognition error:', event.error);
              setIsListening(false);
              stopAnimation();
              if (onError) {
                onError(event.error || 'Speech recognition failed');
              }
            };

            recognitionRef.current.onend = () => {
              setIsListening(false);
              stopAnimation();
            };
            
            if (__DEV__) {
              console.log('Web Speech API initialized successfully');
            }
            return true; // Successfully initialized
          } catch (initError) {
            if (__DEV__) {
              console.warn('Failed to create SpeechRecognition instance:', initError);
            }
          }
        } else {
          if (__DEV__) {
            console.warn('Web Speech API not available. Platform:', Platform.OS);
          }
        }
      }
      return false; // Not available
    } catch (error) {
      console.error('Failed to initialize Web Speech API:', error);
      return false;
    }
  };

  const startAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animationValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animationValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAnimation = () => {
    animationValue.setValue(0);
    animationValue.stopAnimation();
  };

  const startListening = async () => {
    if (disabled || isListening) {
      return;
    }

    try {
      triggerHapticImpact();
      setIsProcessing(true);

      // First, always try Web Speech API if available (works in web and iOS Safari/webviews)
      // This is the best option for real-time transcription and doesn't require native modules
      if (typeof window !== 'undefined') {
        // Try to initialize if not already done
        if (!recognitionRef.current) {
          const initialized = initializeWebSpeechRecognition();
          if (!initialized && Platform.OS !== 'web' && AudioModule) {
            // If Web Speech API is not available, continue to native recording flow below
          } else if (!initialized) {
            // No options available
            setIsProcessing(false);
            if (onError) {
              onError('Speech recognition is not available. Please use a browser that supports Web Speech API (Chrome, Edge, Safari) or ensure microphone permissions are enabled.');
            }
            return;
          }
        }
        
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
            startAnimation();
            setIsProcessing(false);
            return; // Success!
          } catch (webError: any) {
            // Web Speech API failed, try native recording as fallback if available
            if (__DEV__) {
              console.warn('Web Speech API start failed, trying native recording:', webError);
            }
            // Continue to try native recording as fallback
          }
        }
      }

      // For native apps (iOS/Android), try using expo-av for recording
      if (Platform.OS !== 'web') {
        // AudioModule is imported directly - should always be available in production builds
        // Try to use it, but handle gracefully if not available
        if (!AudioModule || !AudioModule.getPermissionsAsync || !AudioModule.requestPermissionsAsync) {
          // Audio module not available - try Web Speech API as fallback
          if (__DEV__) {
            console.warn('expo-av not available, falling back to Web Speech API');
          }
          
          // Try Web Speech API one more time as fallback
          if (typeof window !== 'undefined') {
            try {
              const initialized = initializeWebSpeechRecognition();
              if (initialized && recognitionRef.current) {
                recognitionRef.current.start();
                setIsListening(true);
                startAnimation();
                setIsProcessing(false);
                return; // Success with Web Speech API!
              }
            } catch (fallbackError) {
              // Both methods failed
              if (__DEV__) {
                console.warn('Web Speech API fallback also failed:', fallbackError);
              }
            }
          }
          
          // No options available - show user-friendly message
          const errorMsg = 'Speech-to-text will be available after the app is updated. For now, you can type your message.';
          if (onError) {
            onError(errorMsg);
          } else {
            Alert.alert('Speech Recognition', errorMsg, [{ text: 'OK' }]);
          }
          setIsProcessing(false);
          return;
        }

        try {
          // Request permissions first - this will show the iOS permission dialog
          // On iOS, this will trigger the system permission prompt
          const permissionGranted = await requestAudioPermissions();
          
          if (!permissionGranted) {
            setIsProcessing(false);
            return; // Error already handled in requestAudioPermissions
          }

          // Permission granted, start recording
          await startNativeRecording();
          setIsListening(true);
          startAnimation();
          setIsProcessing(false);
          return; // Success!
        } catch (nativeError: any) {
          console.error('Native recording failed:', nativeError);
          
          // If native fails, try Web Speech API one more time as fallback (works in iOS Safari)
          if (typeof window !== 'undefined') {
            try {
              initializeWebSpeechRecognition();
              if (recognitionRef.current) {
                recognitionRef.current.start();
                setIsListening(true);
                startAnimation();
                setIsProcessing(false);
                return; // Success with fallback!
              }
            } catch (fallbackError) {
              // Both methods failed
              if (__DEV__) {
                console.warn('Web Speech API fallback also failed:', fallbackError);
              }
            }
          }
          
          // Provide helpful error message
          const errorMessage = nativeError.message || 'Failed to start recording. Please check microphone permissions in your device settings.';
          if (onError) {
            onError(errorMessage);
          } else {
            Alert.alert('Microphone Access', errorMessage);
          }
          setIsProcessing(false);
          return;
        }
      }

      // If we get here, nothing worked yet
      // Try one final time to initialize Web Speech API with fresh attempt
      if (typeof window !== 'undefined') {
        const initialized = initializeWebSpeechRecognition();
        if (initialized && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
            startAnimation();
            setIsProcessing(false);
            return; // Success!
          } catch (finalError: any) {
            if (__DEV__) {
              console.warn('Final Web Speech API attempt failed:', finalError);
            }
          }
        }
      }

      // If all methods failed, provide helpful guidance
      // Don't throw error, just show message and let user know
      const platformMessage = Platform.OS === 'web' 
        ? 'Speech recognition is not available in this browser. Please use Chrome, Edge, or Safari.'
        : 'Speech recognition is not available on this device. Please try:\n1. Using the web version in Chrome or Safari\n2. Ensuring microphone permissions are enabled\n3. Checking if your device supports speech recognition';
      
      if (onError) {
        onError(platformMessage);
      } else {
        Alert.alert('Speech Recognition Unavailable', platformMessage);
      }
      
      setIsProcessing(false);
      return; // Exit gracefully without throwing
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      setIsListening(false);
      stopAnimation();
      setIsProcessing(false);
      
      const errorMessage = error.message || 'Failed to start speech recognition. Please try again.';
      if (onError) {
        onError(errorMessage);
      } else {
        Alert.alert('Speech Recognition', errorMessage);
      }
    }
  };

  const stopListening = async () => {
    if (!isListening) return;

    try {
      if (Platform.OS === 'web' && recognitionRef.current) {
        recognitionRef.current.stop();
      } else if (recordingRef.current) {
        await stopNativeRecording();
      }
      
      setIsListening(false);
      stopAnimation();
      triggerHapticImpact();
    } catch (error) {
      console.error('Error stopping recognition:', error);
      setIsListening(false);
      stopAnimation();
    }
  };

  const startNativeRecording = async () => {
    try {
      // AudioModule is imported directly - should always be available in production builds
      // Ensure Audio module is available and has required methods
      if (!AudioModule || !AudioModule.setAudioModeAsync || !AudioModule.Recording) {
        throw new Error('Audio recording module is not available. Using Web Speech API instead.');
      }

      // Start audio recording
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Use recording options - handle case where presets might not be available
      const recordingOptions = AudioModule.RecordingOptionsPresets?.HIGH_QUALITY || {
        android: {
          extension: '.m4a',
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4aac',
          audioQuality: 127, // HIGH
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await AudioModule.Recording.createAsync(recordingOptions);

      recordingRef.current = recording;

      // Set up recording status updates for real-time feedback
      recording.setOnRecordingStatusUpdate((status: any) => {
        if (status.isRecording && status.durationMillis) {
          // Recording is active - we can show visual feedback
          if (__DEV__) {
            console.log('Recording duration:', status.durationMillis, 'ms');
          }
        }
      });

      // Start backend session for transcription tracking
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/speech/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          sessionIdRef.current = data.recordingId;
          
          // Start polling for transcripts (if backend provides real-time transcription)
          // Note: For now, Web Speech API is preferred for real-time transcription
          startTranscriptPolling();
        } else {
          if (__DEV__) {
            console.warn('Backend transcription service not available, using local recording only');
          }
          // Continue without backend - recording will still work
        }
      } catch (backendError) {
        if (__DEV__) {
          console.warn('Backend not available for transcription, using local recording:', backendError);
        }
        // Continue without backend - recording will still work
      }
    } catch (error) {
      console.error('Native recording error:', error);
      throw error;
    }
  };

  const stopNativeRecording = async () => {
    try {
      // Stop audio recording
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      // Stop polling
      if (transcriptPollIntervalRef.current) {
        clearInterval(transcriptPollIntervalRef.current);
        transcriptPollIntervalRef.current = null;
      }

      // Stop backend session and get final transcript
      if (sessionIdRef.current) {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/speech/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordingId: sessionIdRef.current }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transcript) {
            onTranscript(data.transcript);
          }
        }

        sessionIdRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping native recording:', error);
    }
  };

  const startTranscriptPolling = () => {
    if (transcriptPollIntervalRef.current) {
      clearInterval(transcriptPollIntervalRef.current);
    }

    // For native recording, we need to send audio chunks to backend for transcription
    // Since we don't have a real transcription service, we'll use Web Speech API as primary
    // This polling is mainly for backend-based transcription if implemented
    transcriptPollIntervalRef.current = setInterval(async () => {
      if (!sessionIdRef.current || !isListening) {
        if (transcriptPollIntervalRef.current) {
          clearInterval(transcriptPollIntervalRef.current);
          transcriptPollIntervalRef.current = null;
        }
        return;
      }

      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/speech/transcript?recordingId=${sessionIdRef.current}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.transcript) {
            // Append new transcript parts
            onTranscript(data.transcript);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Polling error:', error);
        }
      }
    }, 300); // Poll every 300ms for more real-time feel
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const pulseOpacity = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <TouchableOpacity
      style={[
        styles.button, 
        style, 
        isListening && styles.buttonListening,
        (disabled || isProcessing) && styles.buttonDisabled,
        !isListening && !isProcessing && styles.buttonInactive, // Semi-transparent when not active
      ]}
      onPress={handleToggleListening}
      disabled={disabled || isProcessing}
      activeOpacity={0.7}
    >
      {isProcessing ? (
        <ActivityIndicator size="small" color={theme.colors.primary.main} />
      ) : (
        <>
          <Text style={[
            styles.icon, 
            isListening && styles.iconListening,
            disabled && styles.iconDisabled,
          ]}>🎤</Text>
          {isListening && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  opacity: pulseOpacity,
                  transform: [
                    {
                      scale: animationValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40, // Slightly smaller for better fit
    height: 40, // Slightly smaller for better fit
    borderRadius: 20,
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...theme.shadows.small, // Softer shadow
  },
  buttonListening: {
    backgroundColor: theme.colors.primary.main, // Full color when listening
    borderColor: theme.colors.primary.main,
    borderWidth: 2,
    opacity: 1, // Fully opaque when listening
    ...theme.shadows.medium, // More prominent when active
  },
  icon: {
    fontSize: 20, // Slightly smaller icon
    zIndex: 1, // Ensure icon is above pulse ring
  },
  iconListening: {
    fontSize: 22, // Slightly larger when listening
    zIndex: 1,
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary.main,
    zIndex: 0, // Behind icon
  },
  buttonDisabled: {
    opacity: 0.4, // More visible when disabled
    backgroundColor: theme.colors.background.secondary,
  },
  buttonInactive: {
    opacity: 0.5, // Semi-transparent when not listening
  },
  iconDisabled: {
    opacity: 0.5,
  },
});
