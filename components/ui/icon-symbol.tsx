// Fallback for using MaterialIcons on Android and web.
// iOS uses icon-symbol.ios.tsx which uses native SF Symbols

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // Mood icons for Home tab
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'star.fill': 'star',
  'face.smiling': 'mood',
  'face.smiling.fill': 'mood',
  // Navigation icons
  'bubble.left.and.bubble.right.fill': 'forum',
  'bookmark.fill': 'bookmark',
  'gearshape.fill': 'settings',
  'plus.circle.fill': 'add-circle',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'medium',
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Ensure color is never undefined - use fallback
  const iconColor = color || '#9CA3AF';
  
  // Use MaterialIcons on Android and web
  // iOS will use icon-symbol.ios.tsx automatically
  return <MaterialIcons color={iconColor} size={size} name={MAPPING[name]} style={style} />;
}
