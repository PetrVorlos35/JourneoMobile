import { Platform } from 'react-native';

// Barvy převzaté z webového Journea (jedna modrá, světlý režim).
export const Colors = {
  primary: '#155dfc',
  primarySoft: '#eaf1ff',
  background: '#f4f5f8',
  surface: '#ffffff',
  text: '#0b0d12',
  textSecondary: '#626875',
  textTertiary: '#9aa0ab',
  separator: '#e6e8ee',
  success: '#16a34a',
  successSoft: '#e8f6ee',
  warning: '#d97706',
  warningSoft: '#fdf3e4',
  danger: '#dc2626',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 22,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded' },
  default: { sans: 'normal', rounded: 'normal' },
});
