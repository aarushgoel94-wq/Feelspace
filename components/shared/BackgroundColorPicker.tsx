/**
 * Background Color Picker Component
 * Allows users to select from predefined aesthetic background colors
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import {
  BACKGROUND_COLOR_OPTIONS,
  getBackgroundColorId,
  setBackgroundColor,
  type BackgroundColorId,
} from '~app/utils/themeSettings';

interface BackgroundColorPickerProps {
  onColorChange?: (colorId: BackgroundColorId, color: string) => void;
}

export const BackgroundColorPicker: React.FC<BackgroundColorPickerProps> = ({ onColorChange }) => {
  const [selectedId, setSelectedId] = useState<BackgroundColorId>('default');

  useEffect(() => {
    loadSelectedColor();
  }, []);

  const loadSelectedColor = async () => {
    try {
      const colorId = await getBackgroundColorId();
      setSelectedId(colorId);
    } catch (error) {
      console.error('Error loading selected color:', error);
    }
  };

  const handleColorSelect = async (colorId: BackgroundColorId) => {
    try {
      setSelectedId(colorId);
      await setBackgroundColor(colorId);
      
      const selectedOption = BACKGROUND_COLOR_OPTIONS.find(opt => opt.id === colorId);
      if (selectedOption && onColorChange) {
        onColorChange(colorId, selectedOption.color);
      }
    } catch (error) {
      console.error('Error saving background color:', error);
    }
  };

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>Background Color</Text>
        <Text style={styles.description} numberOfLines={1}>
          Choose a color that matches your mood
        </Text>
      </View>

      <View style={styles.colorGrid}>
        {BACKGROUND_COLOR_OPTIONS.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.colorOption}
              onPress={() => handleColorSelect(option.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.colorCircle,
                  { backgroundColor: option.color },
                  isSelected && styles.colorCircleSelected,
                ]}
              >
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.colorName, isSelected && styles.colorNameSelected]} numberOfLines={1}>
                {option.name}
              </Text>
              <Text style={styles.colorDescription} numberOfLines={1}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  header: {
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.xs / 2,
    numberOfLines: 1,
  },
  description: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: theme.typography.fontSize.xs * theme.typography.lineHeight.relaxed,
    numberOfLines: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  colorOption: {
    width: '47%',
    alignItems: 'center',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: theme.spacing.xs / 2,
    borderWidth: 2.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  colorCircleSelected: {
    borderColor: theme.colors.primary.main,
    borderWidth: 3,
    shadowColor: theme.colors.primary.main,
    shadowOpacity: 0.4,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: theme.colors.background.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  colorName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: 1,
    textAlign: 'center',
    numberOfLines: 1,
    opacity: 1,
  },
  colorNameSelected: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
    opacity: 1,
  },
  colorDescription: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    numberOfLines: 1,
    opacity: 1,
  },
});

