import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput as RNTextInput, Alert } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { theme } from '~app/theme';
import { triggerHapticNotification, triggerHapticImpact } from '~app/utils/haptics';
import { MicroFeedback } from '~app/components/shared/MicroFeedback';
import { ANIMATION_DURATION } from '~app/utils/animations';
import { PrimaryButton } from '~app/components/shared/PrimaryButton';
import { AnimatedMoodButton } from '~app/components/shared/AnimatedMoodButton';
import { RoomChip } from '~app/components/shared/RoomChip';
import { TextInputWithSpeech } from '~app/components/shared/TextInputWithSpeech';
import { SpeechToTextButton } from '~app/components/shared/SpeechToTextButton';
import { moderateContent } from '~app/utils/contentModeration';
import { rateLimiter } from '~app/utils/rateLimiter';
import { sessionManager } from '~app/models/session';
import { CooldownScreen } from '~app/components/shared/CooldownScreen';
import { api } from '~app/services/api';
import { getDeviceId } from '~app/utils/deviceId';
import { roomsService } from '~app/services/rooms.service';
import { analytics } from '~app/services/analytics';
import { mixpanelService } from '~app/services/mixpanel.service';
import { storage } from '~app/models/storage';
import { initializeDefaultRooms } from '~app/models/mockData';
import { ErrorView } from './ErrorView';
import { isEmotionalMirrorEnabled } from '~app/utils/emotionalMirrorSettings';
import { MoodLevel } from '~app/models/types';

// Mood options matching the home page mood checker
interface MoodOption {
  emoji: string;
  label: string;
  moodLevel: MoodLevel;
  displayLabel: string;
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😢', label: 'Low', moodLevel: 'Low', displayLabel: 'Tough', color: '#93C5FD' },
  { emoji: '😐', label: 'Meh', moodLevel: 'Meh', displayLabel: 'Meh', color: '#A5B4FC' },
  { emoji: '🙂', label: 'Okay', moodLevel: 'Okay', displayLabel: 'Okay', color: '#818CF8' },
  { emoji: '😊', label: 'Good', moodLevel: 'Good', displayLabel: 'Good', color: '#6366F1' },
  { emoji: '😄', label: 'Great', moodLevel: 'Great', displayLabel: 'Great', color: '#10B981' },
];

// Enhanced local reflection generator with DBT skills recommendations
// Generates more specific and varied reflections based on actual text content
function generateLocalReflection(text: string): string | null {
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const wordCount = words.length;
  const characterCount = text.trim().length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hasQuestionMarks = text.includes('?');
  const hasExclamationMarks = text.includes('!');
  
  // Minimum length check - if too short, don't generate reflection
  const MIN_WORDS = 8;
  const MIN_CHARACTERS = 20;
  if (wordCount < MIN_WORDS || characterCount < MIN_CHARACTERS) {
    return null; // Signal that message is too short
  }
  
  // Generate unique seed based on text content and timestamp for variation
  const textHash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeSeed = Date.now() % 1000;
  const uniqueSeed = (textHash + timeSeed) % 100;
  
  // Extract key phrases and context
  const extractContext = (text: string): { topic?: string; intensity?: string } => {
    const workKeywords = ['work', 'job', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline', 'career'];
    const relationshipKeywords = ['relationship', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'friend', 'family', 'parent', 'sibling'];
    const schoolKeywords = ['school', 'class', 'teacher', 'homework', 'exam', 'test', 'student', 'college', 'university'];
    const healthKeywords = ['health', 'sick', 'doctor', 'hospital', 'pain', 'medical', 'illness', 'treatment'];
    const financialKeywords = ['money', 'bills', 'payment', 'debt', 'income', 'expenses', 'financial', 'salary'];
    
    if (workKeywords.some(k => lowerText.includes(k))) return { topic: 'work' };
    if (relationshipKeywords.some(k => lowerText.includes(k))) return { topic: 'relationships' };
    if (schoolKeywords.some(k => lowerText.includes(k))) return { topic: 'school' };
    if (healthKeywords.some(k => lowerText.includes(k))) return { topic: 'health' };
    if (financialKeywords.some(k => lowerText.includes(k))) return { topic: 'financial' };
    
    // Determine intensity
    const intenseWords = ['really', 'very', 'extremely', 'incredibly', 'terribly', 'awfully', 'so much', 'too much'];
    if (intenseWords.some(w => lowerText.includes(w))) return { intensity: 'high' };
    
    return {};
  };
  
  const context = extractContext(text);
  
  // DBT Skills mapping based on emotion patterns
  const getDBTSkill = (emotionPattern: string, topic?: string, intensity?: string): string => {
    const skillMap: Record<string, string[]> = {
      'frustrated': [
        'Consider using **Check the Facts** to separate facts from interpretations about what\'s happening.',
        'Try **Opposite Action** - if frustration makes you want to avoid, see if gently approaching the situation might help.',
        'Use **Mindfulness - Describe** to observe your frustration without judgment, acknowledging it as information.',
      ],
      'sad': [
        '**Self-Soothe** can help - engage your senses with something comforting (warm drink, soft blanket, calming music).',
        'Try **Radical Acceptance** - acknowledging your sadness without fighting it can reduce suffering.',
        'Consider **Opposite Action** - sadness might want you to withdraw, but gentle connection or activity can help.',
      ],
      'angry': [
        '**TIPP** (Temperature, Intense exercise, Paced breathing, Progressive muscle relaxation) can quickly reduce anger\'s intensity.',
        'Use **STOP** skill: Stop, Take a step back, Observe, Proceed mindfully before reacting.',
        '**Check the Facts** - anger often comes from interpretations; checking what actually happened can help.',
      ],
      'anxious': [
        '**TIPP** - particularly paced breathing - can help regulate your body\'s anxious response.',
        'Try **Wise Mind** - balancing emotional mind and reasonable mind to find clarity.',
        'Use **Radical Acceptance** - accepting uncertainty can reduce the suffering anxiety brings.',
      ],
      'lonely': [
        '**Self-Soothe** - being kind to yourself can help when you feel disconnected.',
        'Consider **Opposite Action** - loneliness might want you to isolate, but gentle social connection can help.',
        '**Mindfulness - Participate** - fully engaging in the present moment can reduce feelings of isolation.',
      ],
      'overwhelmed': [
        '**STOP** skill - Stop, Take a step back, Observe, Proceed mindfully when everything feels too much.',
        'Try **One-Mindfully** - focus on just one thing at a time instead of everything at once.',
        '**Build Mastery** - doing one small thing well can help counter feelings of overwhelm.',
      ],
      'tired': [
        '**PLEASE** - treat physical illness, balanced eating, avoid drugs, sleep, exercise - can help with exhaustion.',
        '**Self-Soothe** - rest and restoration are essential, not luxuries.',
        'Consider **Radical Acceptance** - sometimes you need rest, and that\'s okay.',
      ],
      'confused': [
        '**Check the Facts** - gathering clear information can reduce confusion.',
        '**Wise Mind** - balancing what you feel with what you know can bring clarity.',
        '**Mindfulness - Observe** - noticing confusion without judgment can help it settle.',
      ],
      'hurt': [
        '**Self-Soothe** - being gentle with yourself when hurt is important.',
        'Try **Radical Acceptance** - accepting pain without intensifying it with judgment.',
        '**Validate** yourself - your feelings make sense given what happened.',
      ],
      'disappointed': [
        '**Check the Facts** - examining expectations vs. reality can help process disappointment.',
        '**Radical Acceptance** - accepting what is, even when it\'s not what you wanted.',
        '**Opposite Action** - disappointment might want you to withdraw, but gentle engagement can help.',
      ],
      'guilt': [
        '**Check the Facts** - guilt often comes from harsh self-judgment; check if your standards are realistic.',
        '**Opposite Action** - if guilt is unjustified, acting opposite to it can help.',
        '**Self-Validate** - acknowledge your intentions and efforts, not just outcomes.',
      ],
      'grateful': [
        '**Mindfulness - Participate** - fully engaging in positive moments amplifies gratitude.',
        '**Accumulate Positive** - build on this positive feeling by noticing other good things.',
        '**Build Mastery** - gratitude often comes from meaningful experiences; continue building these.',
      ],
      'hopeless': [
        '**Opposite Action** - hopelessness might want you to give up, but small steps forward can help.',
        '**Accumulate Positive** - even when things feel dark, small positives can add up.',
        '**Wise Mind** - balancing emotional despair with reasonable hope can bring perspective.',
      ],
      'proud': [
        '**Build Mastery** - continue doing things that build competence and self-confidence.',
        '**Accumulate Positive** - let this positive feeling remind you of your capabilities.',
        '**Mindfulness - Participate** - fully engage in and celebrate your accomplishments.',
      ],
    };
    
    const skills = skillMap[emotionPattern] || [];
    if (skills.length > 0) {
      return skills[uniqueSeed % skills.length];
    }
    return 'Consider using **Mindfulness** - observe your emotions without judgment, acknowledging them as information.';
  };
  
  const patterns = [
    {
      keywords: ['frustrated', 'frustrating', 'annoyed', 'annoying', 'irritated', 'frustration'],
      emotionPattern: 'frustrated',
      reflections: [
        `There's a sense of frustration here${context.topic === 'work' ? '—especially around work or professional expectations' : context.topic === 'relationships' ? '—particularly in how relationships are playing out' : ''}. This feeling often shows up when something isn't working the way it should, creating tension between what you hoped for and what's actually happening.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`,
        context.topic ? `Frustration is coming through strongly around ${context.topic} matters. This emotion typically signals a gap between your expectations and reality—something that matters to you isn't aligning with how things are unfolding.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}` : `Frustration is coming through strongly. This emotion typically signals a gap between your expectations and reality—something that matters to you isn't aligning with how things are unfolding.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`,
        `I notice frustration in what you've shared${context.intensity === 'high' ? ', and it seems quite intense' : ''}. This feeling often appears when your system senses that something important isn't being handled the way you need it to be.\n\n${getDBTSkill('frustrated', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['sad', 'sadness', 'down', 'depressed', 'unhappy', 'blue'],
      emotionPattern: 'sad',
      reflections: [
        context.topic ? `Sadness is present in what you've shared, particularly around ${context.topic}. This emotion often signals that something important feels lost, missing, or unfulfilled—your system is acknowledging that something matters deeply to you.\n\n${getDBTSkill('sad', context.topic, context.intensity)}` : `Sadness is present in what you've shared. This emotion often signals that something important feels lost, missing, or unfulfilled—your system is acknowledging that something matters deeply to you.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`,
        context.topic ? `There's a weight of sadness here related to ${context.topic}. This feeling can emerge when you're processing a loss, a disappointment, or when something meaningful feels out of reach. It's your way of honoring what matters.\n\n${getDBTSkill('sad', context.topic, context.intensity)}` : `There's a weight of sadness here. This feeling can emerge when you're processing a loss, a disappointment, or when something meaningful feels out of reach. It's your way of honoring what matters.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`,
        `Sadness is showing up${context.intensity === 'high' ? ' quite intensely' : ''} in what you're experiencing. This emotion often appears when something tender or important has been touched, and your system is responding to that sensitivity.\n\n${getDBTSkill('sad', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['angry', 'anger', 'mad', 'furious', 'rage', 'pissed', 'livid'],
      emotionPattern: 'angry',
      reflections: [
        context.topic ? `Anger is coming through strongly here around ${context.topic}. This emotion often points to a boundary being crossed, a value being violated, or a need not being met—your system is saying "this isn't okay."\n\n${getDBTSkill('angry', context.topic, context.intensity)}` : `Anger is coming through strongly here. This emotion often points to a boundary being crossed, a value being violated, or a need not being met—your system is saying "this isn't okay."\n\n${getDBTSkill('angry', context.topic, context.intensity)}`,
        `There's anger present${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. Anger typically signals that something important to you—your boundaries, values, or needs—isn't being respected or addressed.\n\n${getDBTSkill('angry', context.topic, context.intensity)}`,
        context.topic ? `Anger is showing up around ${context.topic} matters. This feeling often emerges when you sense that something isn't fair, isn't right, or when your limits are being tested. It's your system's way of protecting what matters to you.\n\n${getDBTSkill('angry', context.topic, context.intensity)}` : `Anger is showing up. This feeling often emerges when you sense that something isn't fair, isn't right, or when your limits are being tested. It's your system's way of protecting what matters to you.\n\n${getDBTSkill('angry', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['anxious', 'anxiety', 'worried', 'worry', 'nervous', 'stress', 'stressed', 'panic', 'overwhelmed'],
      emotionPattern: 'anxious',
      reflections: [
        context.topic ? `Anxiety and worry are present in what you're experiencing, especially around ${context.topic}. This often shows up when your mind is trying to prepare for something uncertain or when you're sensing potential threat—your body is responding to something that feels unsafe or unpredictable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}` : `Anxiety and worry are present in what you're experiencing. This often shows up when your mind is trying to prepare for something uncertain or when you're sensing potential threat—your body is responding to something that feels unsafe or unpredictable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`,
        `There's anxiety here${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Anxiety typically appears when your system is trying to anticipate and prepare for potential challenges, even when the exact nature of those challenges isn't clear yet.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`,
        context.topic ? `Worry and anxiety are showing up around ${context.topic}. This feeling often emerges when you're facing uncertainty or when something important feels out of your control. Your mind is working to keep you safe, even if it feels uncomfortable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}` : `Worry and anxiety are showing up. This feeling often emerges when you're facing uncertainty or when something important feels out of your control. Your mind is working to keep you safe, even if it feels uncomfortable.\n\n${getDBTSkill('anxious', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['lonely', 'loneliness', 'alone', 'isolated', 'disconnected', 'empty'],
      emotionPattern: 'lonely',
      reflections: [
        context.topic === 'relationships' 
          ? `Loneliness is showing up here—particularly in how you're experiencing connection (or lack of it) with others—a sense of being disconnected or unseen, even when others might be around. This feeling often points to a need for deeper connection or understanding from others.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`
          : `Loneliness is showing up here—a sense of being disconnected or unseen, even when others might be around. This feeling often points to a need for deeper connection or understanding from others.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`,
        `There's a sense of loneliness present${context.intensity === 'high' ? ', and it seems quite profound' : ''}. This feeling can emerge when you're physically alone or when you're surrounded by people but still feel disconnected from them. It signals a longing for meaningful connection.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`,
        context.topic ? `Loneliness is coming through in how you're experiencing ${context.topic}. This emotion often appears when there's a gap between the connection you need and what you're experiencing, whether that's with friends, family, or a partner.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}` : `Loneliness is coming through. This emotion often appears when there's a gap between the connection you need and what you're experiencing, whether that's with friends, family, or a partner.\n\n${getDBTSkill('lonely', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['overwhelmed', 'overwhelming', 'too much', 'can\'t handle', 'drowning', 'swamped'],
      emotionPattern: 'overwhelmed',
      reflections: [
        context.topic 
          ? `This feels overwhelming, especially around ${context.topic}—like there's more happening than you can process or manage right now. Your system is signaling that the demands or emotions exceed your current capacity to handle them.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
          : `This feels overwhelming—like there's more happening than you can process or manage right now. Your system is signaling that the demands or emotions exceed your current capacity to handle them.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`,
        `There's a sense of being overwhelmed${context.intensity === 'high' ? ', and it\'s quite intense' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. This feeling often appears when multiple pressures, responsibilities, or emotions are converging at once, creating a sense that you're at capacity.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`,
        context.topic 
          ? `You're experiencing overwhelm around ${context.topic}. This typically shows up when the demands on your time, energy, or emotional resources feel like they're exceeding what you have available to give.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
          : `You're experiencing overwhelm. This typically shows up when the demands on your time, energy, or emotional resources feel like they're exceeding what you have available to give.\n\n${getDBTSkill('overwhelmed', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['tired', 'exhausted', 'drained', 'worn out', 'burned out', 'fatigued'],
      emotionPattern: 'tired',
      reflections: [
        `You're feeling deeply tired and drained${context.topic === 'work' ? ', possibly from work-related stress or demands' : ''}. This exhaustion often shows up when you've been giving more energy than you've been able to replenish, or when emotional weight has been accumulating over time.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`,
        `There's exhaustion present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. This feeling often emerges when your resources—physical, emotional, or mental—have been consistently drawn from without adequate replenishment.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`,
        context.topic ? `Tiredness and exhaustion are showing up around ${context.topic} matters. This typically appears when you've been pushing through challenges, carrying responsibilities, or managing emotions for an extended period without sufficient rest or restoration.\n\n${getDBTSkill('tired', context.topic, context.intensity)}` : `Tiredness and exhaustion are showing up. This typically appears when you've been pushing through challenges, carrying responsibilities, or managing emotions for an extended period without sufficient rest or restoration.\n\n${getDBTSkill('tired', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['confused', 'confusing', 'don\'t understand', 'unclear', 'lost', 'uncertain'],
      emotionPattern: 'confused',
      reflections: [
        context.topic ? `Confusion is present here around ${context.topic}—like pieces don't quite fit together or the path forward isn't clear. This feeling often shows up when there's conflicting information, unclear expectations, or when you're navigating something new.\n\n${getDBTSkill('confused', context.topic, context.intensity)}` : `Confusion is present here—like pieces don't quite fit together or the path forward isn't clear. This feeling often shows up when there's conflicting information, unclear expectations, or when you're navigating something new.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`,
        `There's a sense of confusion${context.intensity === 'high' ? ', and it seems quite disorienting' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Confusion typically appears when information doesn't align, when expectations are unclear, or when you're trying to make sense of something that feels contradictory.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`,
        `Confusion is showing up${context.topic ? ` around ${context.topic} matters` : ''}${hasQuestionMarks ? ', and I notice you\'re asking questions about it' : ''}. This feeling often emerges when you're in transition, facing new situations, or when the information you have doesn't create a clear picture of what to expect or how to proceed.\n\n${getDBTSkill('confused', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['hurt', 'hurting', 'pain', 'painful', 'ache', 'aching'],
      emotionPattern: 'hurt',
      reflections: [
        `There's hurt present in what you've shared${context.topic === 'relationships' ? ', particularly around relationships or connections with others' : ''}. This emotional pain often signals that something tender or important has been touched, damaged, or threatened—your system is acknowledging that something matters and has been affected.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`,
        `Hurt is coming through${context.intensity === 'high' ? ' quite deeply' : ''}${context.topic ? ` in relation to ${context.topic}` : ''}. This feeling typically appears when something that matters to you—your trust, your feelings, your sense of safety—has been impacted in a way that feels painful.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`,
        context.topic ? `There's emotional pain showing up around ${context.topic}. Hurt often emerges when something sensitive or important has been touched in a way that feels damaging or threatening, and your system is responding to protect and acknowledge that sensitivity.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}` : `There's emotional pain showing up. Hurt often emerges when something sensitive or important has been touched in a way that feels damaging or threatening, and your system is responding to protect and acknowledge that sensitivity.\n\n${getDBTSkill('hurt', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['disappointed', 'disappointment', 'let down', 'betrayed', 'betrayal'],
      emotionPattern: 'disappointed',
      reflections: [
        context.topic === 'relationships' 
          ? `Disappointment is coming through—especially in relationships or connections with others—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
          : context.topic 
            ? `Disappointment is coming through around ${context.topic}—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
            : `Disappointment is coming through—like something you hoped for or expected didn't happen the way you needed it to. This feeling often shows up when there's a gap between what you wanted and what actually occurred.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`,
        `There's disappointment present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Disappointment typically appears when expectations weren't met, when someone didn't follow through, or when a hoped-for outcome didn't materialize.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`,
        context.topic ? `Disappointment is showing up around ${context.topic} matters. This feeling often emerges when there's a mismatch between what you anticipated or needed and what actually happened, leaving you with a sense that something important fell short.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}` : `Disappointment is showing up. This feeling often emerges when there's a mismatch between what you anticipated or needed and what actually happened, leaving you with a sense that something important fell short.\n\n${getDBTSkill('disappointed', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['guilt', 'guilty', 'shame', 'ashamed', 'embarrassed'],
      emotionPattern: 'guilt',
      reflections: [
        context.topic ? `Guilt or shame is present here around ${context.topic}. These feelings often show up when you believe you've done something wrong or when you're judging yourself harshly—they can signal a conflict between your actions and your values, or a sense of not measuring up.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}` : `Guilt or shame is present here. These feelings often show up when you believe you've done something wrong or when you're judging yourself harshly—they can signal a conflict between your actions and your values, or a sense of not measuring up.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`,
        `There's guilt or shame${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` related to ${context.topic}` : ''}. These emotions typically appear when you're evaluating your behavior against your standards or values, and feeling that you've fallen short in some way.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`,
        context.topic ? `Guilt and shame are showing up around ${context.topic} matters. These feelings often emerge when you're carrying a sense that you've done something wrong, haven't lived up to expectations (yours or others'), or when you're being particularly hard on yourself.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}` : `Guilt and shame are showing up. These feelings often emerge when you're carrying a sense that you've done something wrong, haven't lived up to expectations (yours or others'), or when you're being particularly hard on yourself.\n\n${getDBTSkill('guilt', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['grateful', 'gratitude', 'thankful', 'appreciate', 'blessed'],
      emotionPattern: 'grateful',
      reflections: [
        context.topic ? `Gratitude is present in what you've shared, especially around ${context.topic}. This feeling often shows up when you recognize something positive or meaningful in your life, even if other challenges exist alongside it—it's a moment of acknowledging what's good.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}` : `Gratitude is present in what you've shared. This feeling often shows up when you recognize something positive or meaningful in your life, even if other challenges exist alongside it—it's a moment of acknowledging what's good.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`,
        `There's gratitude here${context.intensity === 'high' ? ', and it seems quite profound' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Gratitude typically appears when you're able to pause and recognize the positive aspects of your experience, even in the midst of difficulty.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`,
        context.topic ? `Gratitude is showing up around ${context.topic}. This feeling often emerges when you're able to notice and appreciate what's working, what's good, or what you value, creating space for positive feelings alongside whatever challenges you're facing.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}` : `Gratitude is showing up. This feeling often emerges when you're able to notice and appreciate what's working, what's good, or what you value, creating space for positive feelings alongside whatever challenges you're facing.\n\n${getDBTSkill('grateful', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['hopeless', 'hopelessness', 'despair', 'no point', 'nothing matters'],
      emotionPattern: 'hopeless',
      reflections: [
        context.topic ? `Hopelessness is showing up here around ${context.topic}—like the path forward feels blocked or the future looks dark. This feeling often signals that you're struggling to see possibilities or that your energy for moving forward has been depleted.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}` : `Hopelessness is showing up here—like the path forward feels blocked or the future looks dark. This feeling often signals that you're struggling to see possibilities or that your energy for moving forward has been depleted.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`,
        `There's a sense of hopelessness${context.intensity === 'high' ? ', and it seems quite profound' : ''}${context.topic ? ` related to ${context.topic}` : ''}. Hopelessness typically appears when you can't see a way forward, when solutions feel out of reach, or when the future feels uncertain or bleak.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`,
        context.topic ? `Hopelessness is present around ${context.topic} matters. This feeling often emerges when you've been struggling with something for a while, when solutions haven't materialized, or when you're feeling stuck without a clear path to change.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}` : `Hopelessness is present. This feeling often emerges when you've been struggling with something for a while, when solutions haven't materialized, or when you're feeling stuck without a clear path to change.\n\n${getDBTSkill('hopeless', context.topic, context.intensity)}`
      ]
    },
    {
      keywords: ['proud', 'accomplished', 'achievement', 'succeeded', 'did it'],
      emotionPattern: 'proud',
      reflections: [
        context.topic ? `There's a sense of accomplishment or pride here around ${context.topic}. This feeling often shows up when you recognize that you've done something meaningful, overcome a challenge, or moved forward in a way that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}` : `There's a sense of accomplishment or pride here. This feeling often shows up when you recognize that you've done something meaningful, overcome a challenge, or moved forward in a way that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`,
        `Pride and accomplishment are present${context.intensity === 'high' ? ', and it seems quite significant' : ''}${context.topic ? ` related to ${context.topic}` : ''}. These feelings typically appear when you've achieved something, persevered through difficulty, or made progress toward something that matters to you.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`,
        context.topic ? `There's pride showing up around ${context.topic} matters. This feeling often emerges when you've accomplished something, handled a challenge well, or recognized your own growth or capability in some way.\n\n${getDBTSkill('proud', context.topic, context.intensity)}` : `There's pride showing up. This feeling often emerges when you've accomplished something, handled a challenge well, or recognized your own growth or capability in some way.\n\n${getDBTSkill('proud', context.topic, context.intensity)}`
      ]
    },
  ];

  // Find matching patterns
  const matches = patterns.filter(pattern => 
    pattern.keywords.some(keyword => lowerText.includes(keyword))
  );

  if (matches.length > 0) {
    // Select a random reflection from the matched pattern(s) using unique seed for variation
    const selectedPattern = matches[0];
    const reflections = selectedPattern.reflections;
    const reflectionIndex = (uniqueSeed + wordCount + characterCount) % reflections.length;
    const selectedReflection = reflections[reflectionIndex];
    
    // If multiple emotions detected, add context about complexity
    if (matches.length > 1) {
      return selectedReflection + ' There may also be other emotions layered underneath, which is common when dealing with complex situations.';
    }
    return selectedReflection;
  }

  // Context-aware default reflections with DBT skills for generic situations
  if (wordCount > 100) {
    const longReflections = [
      context.topic ? `You've shared a lot here about ${context.topic}—there's depth and complexity in what you're processing. This suggests you're working through something significant that has multiple layers to it.\n\nConsider using **Mindfulness - Observe** to notice what you're experiencing without judgment, and **Check the Facts** to separate what's happening from what you're interpreting.` : `You've shared a lot here—there's depth and complexity in what you're processing. This suggests you're working through something significant that has multiple layers to it.\n\nConsider using **Mindfulness - Observe** to notice what you're experiencing without judgment, and **Check the Facts** to separate what's happening from what you're interpreting.`,
      `There's substantial content here${context.intensity === 'high' ? ', and it seems quite intense' : ''}${context.topic ? ` around ${context.topic}` : ''}. The length and detail suggest you're processing something meaningful that deserves attention and care.\n\n**Wise Mind** - balancing your emotional experience with reasonable perspective - can help you find clarity in complex situations.`,
      context.topic ? `You've put a lot into what you've shared about ${context.topic}. This depth indicates something important is happening—something that matters enough for you to express it fully.\n\nTry **Self-Validate** - acknowledge the significance of what you're experiencing, and consider **Radical Acceptance** if there are aspects you can't change right now.` : `You've put a lot into what you've shared. This depth indicates something important is happening—something that matters enough for you to express it fully.\n\nTry **Self-Validate** - acknowledge the significance of what you're experiencing, and consider **Radical Acceptance** if there are aspects you can't change right now.`
    ];
    return longReflections[(uniqueSeed + wordCount) % longReflections.length];
  }
  
  // Default reflection for medium-length text (8-100 words)
  const defaultReflections = [
    context.topic ? `You've shared something meaningful here about ${context.topic}. There's emotional weight in what you've expressed, and it's clear this matters to you.\n\nConsider **Mindfulness - Describe** to observe your experience, and **Self-Soothe** if you need comfort right now.` : `You've shared something meaningful here. There's emotional weight in what you've expressed, and it's clear this matters to you.\n\nConsider **Mindfulness - Describe** to observe your experience, and **Self-Soothe** if you need comfort right now.`,
    `There's substance in what you've written${context.intensity === 'high' ? ', and the intensity is noticeable' : ''}${context.topic ? ` around ${context.topic}` : ''}. This suggests something important is happening for you.\n\n**Wise Mind** can help balance emotional experience with reasonable thinking, and **Check the Facts** can clarify what's actually happening versus interpretations.`,
    `What you've shared carries significance${context.topic ? ` related to ${context.topic}` : ''}${hasQuestionMarks ? ', and I notice you\'re asking questions about it' : ''}. There's clearly something here that matters to you.\n\n**Mindfulness - Participate** - fully engaging in the present moment - can help ground you as you process this.`,
    context.topic ? `There's depth in what you've expressed about ${context.topic}. It's clear that what you're processing isn't trivial—it has weight and meaning for you.\n\n**Validate** yourself - your feelings make sense. Consider **Self-Soothe** or **Radical Acceptance** depending on what feels most helpful right now.` : `There's depth in what you've expressed. It's clear that what you're processing isn't trivial—it has weight and meaning for you.\n\n**Validate** yourself - your feelings make sense. Consider **Self-Soothe** or **Radical Acceptance** depending on what feels most helpful right now.`
  ];
  return defaultReflections[(uniqueSeed + characterCount) % defaultReflections.length];
}

interface ComposeVentScreenProps {
  onPost?: () => void;
  onCancel?: () => void;
}

const AVAILABLE_ROOMS = [
  'Work Frustrations',
  'Relationships',
  'Anxiety & Worry',
  'Stress Relief',
  'Family Matters',
  'Loneliness',
  'Grief & Loss',
  'Anger',
];

export const ComposeVentScreen: React.FC<ComposeVentScreenProps> = ({
  onPost,
  onCancel,
}) => {
  const [ventText, setVentText] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [moodBefore, setMoodBefore] = useState<MoodLevel>('Okay');
  const [moodAfter, setMoodAfter] = useState<MoodLevel>('Okay');
  const [showCooldown, setShowCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [hasTrackedFirstVentStarted, setHasTrackedFirstVentStarted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<'Posted' | 'Draft saved'>('Posted');
  const [isDraft, setIsDraft] = useState(false); // false = public, true = draft/private

  useEffect(() => {
    // Initialize device ID and rooms
    const initialize = async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
        api.setDeviceId(id);

        // Fetch rooms from both service and storage to ensure we have all rooms
        await initializeDefaultRooms();
        const fetchedRooms = await roomsService.getRooms();
        const storageRooms = await storage.getAllRooms();
        
        // Use storage rooms as source of truth for IDs (they're what we'll save to)
        // But also include service rooms for display
        const allRooms = [...storageRooms, ...fetchedRooms];
        const uniqueRooms = Array.from(
          new Map(allRooms.map(r => [r.name, r])).values()
        );
        
        setRooms(uniqueRooms.map((r) => ({ id: r.id, name: r.name })));

        // If a room name was previously selected, find its ID from storage
        if (selectedRoom) {
          const storageRoom = storageRooms.find((r) => r.name === selectedRoom);
          if (storageRoom) {
            setSelectedRoomId(storageRoom.id);
          } else {
            const serviceRoom = fetchedRooms.find((r) => r.name === selectedRoom);
            if (serviceRoom) {
              // Find matching storage room by name
              const matchingStorageRoom = storageRooms.find(r => r.name === serviceRoom.name);
              setSelectedRoomId(matchingStorageRoom?.id || serviceRoom.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    initialize();
  }, []);

  // Track "vent_started" when user starts typing
  useEffect(() => {
    // Track vent_started when user starts typing (only once per session)
    // PRIVACY: Only tracks that typing started, no content or personal data
    // Non-blocking: Analytics failures never block user experience
    if (ventText.length > 0 && !hasTrackedFirstVentStarted) {
      setHasTrackedFirstVentStarted(true);
      // Track event (non-blocking)
      mixpanelService.trackVentStarted().catch(() => {
        // Silently fail - analytics should never break the app
      });
    }
  }, [ventText, hasTrackedFirstVentStarted]);

  // Update selectedRoomId when selectedRoom changes
  // Always use storage room ID to ensure consistency
  useEffect(() => {
    const updateRoomId = async () => {
      if (selectedRoom) {
        await initializeDefaultRooms();
        const storageRooms = await storage.getAllRooms();
        const storageRoom = storageRooms.find((r) => r.name === selectedRoom);
        if (storageRoom) {
          setSelectedRoomId(storageRoom.id);
        } else if (rooms.length > 0) {
          // Fallback to rooms from state
          const room = rooms.find((r) => r.name === selectedRoom);
          setSelectedRoomId(room?.id || null);
        }
      } else {
        setSelectedRoomId(null);
      }
    };
    updateRoomId();
  }, [selectedRoom, rooms]);

  const characterCount = ventText.length;
  const maxCharacters = 2000;
  
  // Get session ID for rate limiting
  const sessionId = sessionManager.getSessionId();
  
  // Check rate limit
  const rateLimitCheck = useMemo(() => {
    return rateLimiter.canSubmit(sessionId);
  }, [sessionId]); // Re-check when session changes
  
  // Get remaining vents
  const remainingVents = useMemo(() => {
    return rateLimiter.getRemainingVents(sessionId);
  }, [sessionId]);

  // Moderate content as user types (async)
  const [moderationResult, setModerationResult] = useState<{
    hasIssues: boolean;
    warnings: string[];
    blocked: boolean;
    issues: {
      phoneNumbers: boolean;
      emails: boolean;
      addresses: boolean;
      mentions: boolean;
      properNames: boolean;
      hateSpeech: boolean;
      threats: boolean;
    };
  }>({
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
    },
  });

  useEffect(() => {
    const moderate = async () => {
      if (ventText.trim().length === 0) {
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
          },
        });
        return;
      }
      try {
        const result = await moderateContent(ventText);
        setModerationResult({
          hasIssues: result.hasIssues,
          warnings: result.warnings,
          blocked: result.blocked,
          issues: result.issues,
        });
      } catch (error) {
        // If moderation fails, default to allowing (safe fallback)
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
          },
        });
      }
    };
    moderate();
  }, [ventText]);

  const handlePost = async () => {
    if (!deviceId) {
      setError('Device not initialized. Please try again.');
      return;
    }

    // Check if content is blocked
    if (moderationResult.blocked) {
      // Don't submit if blocked, but allow editing
      return;
    }

    // Check rate limit only for public posts (not drafts)
    if (!isDraft) {
      const rateCheck = rateLimiter.canSubmit(sessionId);
      if (!rateCheck.allowed) {
        // Show cooldown screen
        if (rateCheck.cooldownRemaining) {
          setCooldownSeconds(rateCheck.cooldownRemaining);
          setShowCooldown(true);
        }
        return;
      }
    }

    // Validate required fields
    if (!ventText.trim()) {
      setError('Please enter your thoughts before posting.');
      return;
    }

    // Room is optional - if selected, use its ID, otherwise backend will use default
    // Make sure we have the correct room ID from the selected room
    let roomId = selectedRoomId;
    
    // If we have a selected room name but no ID, find the ID
    if (!roomId && selectedRoom && rooms.length > 0) {
      const room = rooms.find((r) => r.name === selectedRoom);
      if (room) {
        roomId = room.id;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const anonymousHandle = sessionManager.getAnonymousHandle();

      // Ensure rooms are initialized before saving
      await initializeDefaultRooms();
      
      // Get a valid room ID from storage (not from roomsService)
      // This ensures the ID matches what's in storage for filtering
      let validRoomId = roomId;
      if (!validRoomId) {
        // Try to find a default room or use the first available room from storage
        const storageRooms = await storage.getAllRooms();
        if (storageRooms.length > 0) {
          validRoomId = storageRooms[0].id;
        } else {
          // Create a default room if none exist
          const defaultRoom = await storage.createRoom({
            name: 'General',
            description: 'General vents',
          });
          validRoomId = defaultRoom.id;
        }
      } else {
        // If we have a roomId, make sure it exists in storage
        // If it's from roomsService, find the matching storage room
        const storageRooms = await storage.getAllRooms();
        const storageRoom = storageRooms.find(r => r.id === roomId || r.name === roomId);
        if (storageRoom) {
          validRoomId = storageRoom.id; // Use storage room ID
        } else {
          // Room ID doesn't exist in storage, find by name or use first available
          const roomByName = storageRooms.find(r => {
            const serviceRooms = rooms.find(sr => sr.id === roomId);
            return r.name === (serviceRooms?.name || roomId);
          });
          validRoomId = roomByName?.id || storageRooms[0]?.id || validRoomId;
        }
      }

      // Always generate reflection (emotional mirror is always enabled by default)
      const mirrorEnabled = await isEmotionalMirrorEnabled();
      let reflection: string | null = null;

      // Convert MoodLevel to number (1-10) for API
      const moodLevelToNumber = (level: MoodLevel): number => {
        const mapping: Record<MoodLevel, number> = {
          'Low': 2,
          'Meh': 4,
          'Okay': 5,
          'Good': 7,
          'Great': 9,
        };
        return mapping[level] || 5;
      };

      const moodBeforeNum = moodLevelToNumber(moodBefore);
      const moodAfterNum = moodLevelToNumber(moodAfter);

      // Submit to API only for public posts (not drafts)
      if (!isDraft) {
        try {
          const createdVent = await api.createVent({
            ...(validRoomId && { roomId: validRoomId }), // Use valid room ID
            text: ventText.trim(),
            anonymousHandle,
            deviceId,
            moodBefore: moodBeforeNum,
            moodAfter: moodAfterNum,
            generateReflection: true, // Always generate reflection
          });
          
          // Store reflection if provided
          if (createdVent.reflection) {
            reflection = createdVent.reflection;
            // Also store in local storage for consistency (don't fail if this errors)
            if (createdVent.id) {
              try {
                await storage.createReflection(createdVent.id, reflection);
              } catch (storageError) {
                if (__DEV__) {
                  console.warn('Failed to store reflection in local storage:', storageError);
                }
                // Continue anyway - reflection is still available from API
              }
            }
          } else {
            // If backend didn't provide reflection, generate locally
            reflection = generateLocalReflection(ventText.trim());
            // Store it in local storage (don't fail if this errors)
            if (reflection && createdVent.id) {
              try {
                await storage.createReflection(createdVent.id, reflection);
              } catch (storageError) {
                if (__DEV__) {
                  console.warn('Failed to store reflection in local storage:', storageError);
                }
                // Continue anyway - reflection is still generated
              }
            }
          }
        } catch (apiError) {
          // Silently fallback to local storage - expected when no backend
          // Save vent to local storage with valid room ID
          const createdVent = await storage.createVent({
            room: validRoomId,
            text: ventText.trim(),
            anonymousHandle,
            moodBefore: moodBeforeNum,
            moodAfter: moodAfterNum,
            isDraft: false, // Public post
          });
          
          // Always generate reflection locally (fallback)
          reflection = generateLocalReflection(ventText.trim());
          
          // Store reflection in local storage (don't fail if this errors)
          if (reflection && createdVent.id) {
            try {
              await storage.createReflection(createdVent.id, reflection);
            } catch (storageError) {
              if (__DEV__) {
                console.warn('Failed to store reflection in local storage:', storageError);
              }
              // Continue anyway - reflection is still generated
            }
          }
        }
      } else {
        // For drafts, save to local storage only
        const createdVent = await storage.createVent({
          room: validRoomId,
          text: ventText.trim(),
          anonymousHandle,
          moodBefore: moodBeforeNum,
          moodAfter: moodAfterNum,
          isDraft: true, // Mark as draft
        });
        
        // Generate reflection for drafts too
        reflection = generateLocalReflection(ventText.trim());
        
        // Store reflection in local storage (don't fail if this errors)
        if (reflection && createdVent.id) {
          try {
            await storage.createReflection(createdVent.id, reflection);
          } catch (storageError) {
            if (__DEV__) {
              console.warn('Failed to store reflection in local storage:', storageError);
            }
            // Continue anyway - reflection is still generated
          }
        }
      }

      // Record the submission for rate limiting (only for public posts)
      if (!isDraft) {
        rateLimiter.recordSubmission(sessionId);
      }

      // Soft haptic feedback on successful post
      triggerHapticNotification();
      
      // Show reflection screen if reflection was generated
      // Otherwise show message that text was too short for reflection
      if (!reflection) {
        // Check if text was too short
        const words = ventText.trim().split(/\s+/).filter(w => w.trim().length > 0);
        const wordCount = words.length;
        const characterCount = ventText.trim().length;
        const MIN_WORDS = 8;
        const MIN_CHARACTERS = 20;
        
        if (wordCount < MIN_WORDS || characterCount < MIN_CHARACTERS) {
          // Text is too short - show message to user
          Alert.alert(
            'Message Too Short',
            'Your message is too short to generate an AI reflection. Please share at least 8 words (about 20 characters) for us to provide meaningful insights and DBT skill recommendations.',
            [{ text: 'OK' }]
          );
        }
        setFeedbackMessage(isDraft ? 'Draft saved' : 'Posted');
        setShowFeedback(true);
      } else {
        // If reflection was generated but it's a draft, still show feedback
        setFeedbackMessage(isDraft ? 'Draft saved' : 'Posted');
        setShowFeedback(true);
      }

      // Track analytics only for public posts (non-blocking)
      if (!isDraft) {
        analytics.trackFirstVent().catch(() => {
          // Silently fail - analytics should never break the app
        });
        analytics.trackMoodImprovement(moodBeforeNum, moodAfterNum).catch(() => {
          // Silently fail
        });

        // Track Mixpanel events (non-blocking)
        // PRIVACY: Only tracks aggregate metadata, no personal data or content
        // - Does NOT log vent text
        // - Does NOT log sensitive room names
        // - Uses coarse timestamps only
        // - Analytics failures never block user experience
        const selectedRoomObj = rooms.find((r) => r.id === validRoomId);
        mixpanelService.trackVentSubmitted({
          roomId: validRoomId || undefined,
          roomName: selectedRoomObj?.name || selectedRoom || undefined, // Used to check if sensitive
          moodBefore: moodBeforeNum,
          moodAfter: moodAfterNum,
          textLength: ventText.trim().length, // Character count only, NOT the actual text
        }).catch(() => {
          // Silently fail - analytics should never break the app
        });

        // Track mood_improved if applicable (when mood slider improves)
        // PRIVACY: Only tracks mood metrics, no personal data or content
        if (moodAfterNum > moodBeforeNum) {
          mixpanelService.trackMoodImproved({
            moodBefore: moodBeforeNum,
            moodAfter: moodAfterNum,
            improvement: moodAfterNum - moodBeforeNum,
          }).catch(() => {
            // Silently fail - analytics should never break the app
          });
        }
      }

      // Save moodBefore and draft status before resetting (for post-vent mood check-in and feedback)
      const savedMoodBefore = moodBefore;
      const wasDraft = isDraft;

      // Reset form immediately (before showing reflection)
      setVentText('');
      setSelectedRoom(null);
      setSelectedRoomId(null);
      setMoodBefore('Okay');
      setMoodAfter('Okay');
      setIsDraft(false); // Reset to public by default
      setIsSubmitting(false);
      
      // Update feedback message based on whether it was a draft
      if (!reflection) {
        setShowFeedback(true);
      } else {
        setShowFeedback(true);
      }

      // Don't show reflection screen automatically - user can access it via button
      // Just complete the post
      if (onPost) {
        onPost();
      }
    } catch (err) {
      setIsSubmitting(false);
      
      // Log error for debugging
      if (__DEV__) {
        console.error('Error posting vent:', err);
      }
      
      // Only show error if it's not a network/API error (those are expected)
      const isNetworkError = err instanceof Error && (
        err.message.includes('Network') || 
        err.message.includes('Failed to fetch') ||
        err.message.includes('Network request failed')
      );
      
      if (!isNetworkError) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to post vent. Please try again.';
        setError(errorMessage);
        if (__DEV__) {
          console.error('Error posting vent:', err);
        }
      } else {
        // Network errors - try to save to local storage as fallback
        try {
          await initializeDefaultRooms();
          const allRooms = await storage.getAllRooms();
          const validRoomId = roomId || (allRooms.length > 0 ? allRooms[0].id : null);
          
          if (validRoomId) {
            await storage.createVent({
              room: validRoomId,
              text: ventText.trim(),
              anonymousHandle: sessionManager.getAnonymousHandle(),
              moodBefore,
              moodAfter,
              isDraft: false, // Public post
            });
            // Successfully saved to local storage, call onPost
            if (onPost) {
              onPost();
            }
            return; // Exit early since we successfully saved
          }
        } catch (storageError) {
          if (__DEV__) {
            console.error('Failed to save to local storage:', storageError);
          }
        }
      }
      // If we get here, something went wrong - show error
      if (!isNetworkError) {
        setError('Failed to post vent. Please try again.');
      }
    }
  };

  const handleCooldownComplete = () => {
    setShowCooldown(false);
    // Re-check rate limit after cooldown
    const newRateCheck = rateLimiter.canSubmit(sessionId);
    if (!newRateCheck.allowed && newRateCheck.cooldownRemaining) {
      setCooldownSeconds(newRateCheck.cooldownRemaining);
      setShowCooldown(true);
    }
  };

  // Show cooldown screen if rate limited, but only if not showing reflection
  // Show cooldown if needed
  if (showCooldown) {
    return (
      <CooldownScreen
        cooldownSeconds={cooldownSeconds}
        onComplete={handleCooldownComplete}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={FadeInDown.duration(theme.animation.duration.normal)}
          style={styles.content}
        >
          <Text style={styles.title}>Share Your Thoughts</Text>
          <Text style={styles.subtitle}>
            Take your time. There's no rush. Your words matter.
          </Text>

          {/* Text Input Area */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <View style={styles.textInputWrapper}>
                <TextInputWithSpeech
                  placeholder="What happened?"
                  value={ventText}
                  onChangeText={setVentText}
                  multiline
                  style={styles.textInput}
                  placeholderTextColor={theme.colors.text.tertiary}
                  showSpeechButton={false}
                />
                {/* Character count - top right */}
                <View style={styles.characterCounter}>
                  <Text style={styles.characterCountText}>
                    {characterCount} / {maxCharacters}
                  </Text>
                </View>
                {/* Microphone - bottom right */}
                <View style={styles.microphoneContainer}>
                  <SpeechToTextButton
                    onTranscript={(transcript) => {
                      const newText = ventText ? `${ventText}${transcript}` : transcript.trim();
                      setVentText(newText);
                    }}
                    onError={(error) => {
                      if (__DEV__) {
                        console.warn('Speech-to-text error:', error);
                      }
                    }}
                    disabled={false}
                    style={styles.microphoneButton}
                  />
                </View>
              </View>
            </View>
            
            {/* Moderation Warnings */}
            {moderationResult.hasIssues && moderationResult.warnings.length > 0 && (
              <Animated.View
                entering={FadeIn.duration(theme.animation.duration.normal)}
                style={[
                  styles.warningContainer,
                  moderationResult.blocked && styles.warningContainerBlocked,
                ]}
              >
                {moderationResult.warnings.map((warning, index) => (
                  <View key={index} style={styles.warningItem}>
                    <Text style={styles.warningIcon}>💭</Text>
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
                {moderationResult.blocked && (
                  <Text style={styles.warningHint}>
                    You can edit your message and try again.
                  </Text>
                )}
              </Animated.View>
            )}
          </View>

          {/* Room Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle} numberOfLines={1}>Choose a room (optional)</Text>
            <Text style={styles.sectionHint} numberOfLines={1}>
              Pick a space that feels right
            </Text>
            <View style={styles.roomsWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.roomsScrollContainer}
                style={styles.roomsScrollView}
                bounces={true}
                decelerationRate="normal"
              >
                {rooms.length > 0 ? (
                  rooms.map((room) => (
                    <RoomChip
                      key={room.id}
                      room={room.name}
                      selected={selectedRoom === room.name}
                      onPress={() =>
                        setSelectedRoom(selectedRoom === room.name ? null : room.name)
                      }
                    />
                  ))
                ) : (
                  // Fallback to hardcoded rooms if API fails
                  AVAILABLE_ROOMS.map((room) => (
                    <RoomChip
                      key={room}
                      room={room}
                      selected={selectedRoom === room}
                      onPress={() => setSelectedRoom(selectedRoom === room ? null : room)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          </View>

          {/* Mood Selector - Before */}
          <View style={styles.section}>
            <Text 
              style={styles.sectionTitle}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              How are you feeling?
            </Text>
            <Text style={styles.sectionHint}>
              Track your mood before sharing
            </Text>
            <View style={styles.moodContainer}>
              {MOOD_OPTIONS.map((mood, index) => (
                <AnimatedMoodButton
                  key={mood.label}
                  mood={mood}
                  isSelected={moodBefore === mood.moodLevel}
                  onPress={(moodOption) => {
                    triggerHapticImpact();
                    setMoodBefore(moodOption.moodLevel);
                  }}
                  disabled={false}
                  index={index}
                />
              ))}
            </View>
          </View>

          {/* Mood Selector - After */}
          <View style={styles.section}>
            <Text 
              style={styles.sectionTitle}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.85}
            >
              How do you feel now?
            </Text>
            <Text style={styles.sectionHint}>
              Optional: Track your mood after sharing
            </Text>
            <View style={styles.moodContainer} collapsable={false}>
              {MOOD_OPTIONS.map((mood, index) => (
                <AnimatedMoodButton
                  key={mood.label}
                  mood={mood}
                  isSelected={moodAfter === mood.moodLevel}
                  onPress={(moodOption) => {
                    triggerHapticImpact();
                    setMoodAfter(moodOption.moodLevel);
                  }}
                  disabled={false}
                  index={index}
                />
              ))}
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(theme.animation.duration.normal)}
              style={styles.errorContainer}
            >
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => setError(null)}
                style={styles.errorDismiss}
              >
                <Text style={styles.errorDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Public/Private Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              Visibility
            </Text>
            <Text style={styles.sectionHint} numberOfLines={2}>
              Choose who can see this post
            </Text>
            <View style={styles.visibilityToggle}>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  !isDraft && styles.visibilityOptionActive,
                ]}
                onPress={() => {
                  triggerHapticImpact();
                  setIsDraft(false);
                }}
                disabled={isSubmitting}
              >
                <Text
                  style={[
                    styles.visibilityOptionText,
                    !isDraft && styles.visibilityOptionTextActive,
                  ]}
                >
                  🌍 Public
                </Text>
                <Text
                  style={[
                    styles.visibilityOptionSubtext,
                    !isDraft && styles.visibilityOptionSubtextActive,
                  ]}
                >
                  Visible to everyone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  isDraft && styles.visibilityOptionActive,
                ]}
                onPress={() => {
                  triggerHapticImpact();
                  setIsDraft(true);
                }}
                disabled={isSubmitting}
              >
                <Text
                  style={[
                    styles.visibilityOptionText,
                    isDraft && styles.visibilityOptionTextActive,
                  ]}
                >
                  🔒 Private
                </Text>
                <Text
                  style={[
                    styles.visibilityOptionSubtext,
                    isDraft && styles.visibilityOptionSubtextActive,
                  ]}
                >
                  Only visible to you
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Post Button */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title={
                isSubmitting
                  ? isDraft
                    ? 'Saving...'
                    : 'Posting...'
                  : isDraft
                  ? 'Save as Draft'
                  : 'Post Vent'
              }
              onPress={handlePost}
              style={[
                styles.postButton,
                (moderationResult.blocked ||
                  (!isDraft && !rateLimitCheck.allowed) ||
                  isSubmitting) &&
                  styles.postButtonDisabled,
              ]}
              disabled={
                moderationResult.blocked ||
                (!isDraft && !rateLimitCheck.allowed) ||
                isSubmitting
              }
              loading={isSubmitting}
            />
            {onCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={styles.cancelButton}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
      
      {/* Micro feedback - gentle acknowledgment */}
      <MicroFeedback
        message={feedbackMessage}
        visible={showFeedback}
        icon="✓"
        onComplete={() => setShowFeedback(false)}
      />
      
    </KeyboardAvoidingView>
  );
};

// Custom TextInput for the vent text area
const TextInput: React.FC<{
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  rows?: number;
  style?: any;
  placeholderTextColor?: string;
}> = ({ placeholder, value, onChangeText, multiline, rows = 4, style, placeholderTextColor }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[inputStyles.container, isFocused && inputStyles.focused]}>
      <RNTextInput
        style={[inputStyles.input, style]}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical="top"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
};

const inputStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border.light,
    padding: theme.spacing.lg,
    minHeight: 200,
  },
  focused: {
    borderColor: theme.colors.primary.main,
  },
  input: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    minHeight: 150,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing['2xl'],
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.bold,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.fontSize.base * theme.typography.lineHeight.relaxed,
    fontFamily: theme.typography.fontFamily.regular,
  },
  inputSection: {
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  textInputWrapper: {
    position: 'relative',
    width: '100%',
  },
  textInput: {
    fontSize: theme.typography.fontSize.base,
    minHeight: 120,
    maxHeight: 200,
    paddingTop: 40, // Space for character count at top
    paddingBottom: 50, // Space for microphone at bottom
    paddingRight: theme.spacing.sm, // Space on right side
  },
  characterCounter: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    zIndex: 10,
    ...theme.shadows.small,
  },
  characterCountText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  microphoneContainer: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    zIndex: 10,
  },
  microphoneButton: {
    opacity: 0.5, // Semi-transparent by default - will be overridden by buttonInactive style
  },
  warningContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary.subtle,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
  },
  warningContainerBlocked: {
    backgroundColor: theme.colors.state.warning + '15', // 15 = ~8% opacity
    borderColor: theme.colors.state.warning,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  warningIcon: {
    fontSize: theme.typography.fontSize.base,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
    fontFamily: theme.typography.fontFamily.regular,
  },
  warningHint: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamily.regular,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.state.error + '15',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.state.error,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.state.error,
    fontFamily: theme.typography.fontFamily.regular,
    marginRight: theme.spacing.sm,
  },
  errorDismiss: {
    paddingHorizontal: theme.spacing.sm,
  },
  errorDismissText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.state.error,
    fontFamily: theme.typography.fontFamily.medium,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base, // Match other mood questions
    fontWeight: theme.typography.fontWeight.medium, // Match other mood questions
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.medium, // Match other mood questions
    textAlign: 'center', // Center align like other mood questions
    lineHeight: theme.typography.fontSize.base * 1.2, // Tighter line height
    paddingHorizontal: theme.spacing.xs, // Minimal padding
    width: '100%', // Full width for proper text fitting
  },
  sectionHint: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary, // Darker
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.fontWeight.medium,
  },
  roomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  roomsWrapper: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch', // Ensure all buttons have same height
    gap: theme.spacing.xs, // Smaller gap for tighter fit
    flexWrap: 'nowrap', // Ensure buttons stay in one line
    overflow: 'hidden', // Prevent overflow
    width: '100%', // Full width container
    paddingHorizontal: 0, // No extra padding
  },
  roomsScrollView: {
    maxHeight: 80,
  },
  roomsScrollContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
  },
  buttonSection: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  postButton: {
    marginTop: theme.spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  visibilityToggle: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityOptionActive: {
    backgroundColor: theme.colors.primary.subtle,
    borderColor: theme.colors.primary.main,
  },
  visibilityOptionText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs,
  },
  visibilityOptionTextActive: {
    color: theme.colors.primary.main,
  },
  visibilityOptionSubtext: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
  visibilityOptionSubtextActive: {
    color: theme.colors.text.secondary,
  },
  reflectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000, // Very high z-index to ensure it's above everything including cooldown
    elevation: 10000, // Android elevation
  },
  reflectionContainer: {
    width: '85%',
    maxWidth: 400,
  },
  reflectionCard: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    ...theme.shadows.large,
  },
  reflectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reflectionText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  reflectionCloseButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reflectionCloseText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.inverse,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

