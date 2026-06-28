import { useColorScheme } from '@/components/useColorScheme';
import { useThemeStore } from '@/src/store/themeStore';

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 16, g: 185, b: 129 };
}

function lighten(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, r + amount);
  const lg = Math.min(255, g + amount);
  const lb = Math.min(255, b + amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function darken(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.max(0, r - amount);
  const dg = Math.max(0, g - amount);
  const db = Math.max(0, b - amount);
  return `rgb(${dr}, ${dg}, ${db})`;
}

export function useColors() {
  const systemScheme = useColorScheme();
  const { mode, primaryColor, bgColor } = useThemeStore();

  const isDark = mode === 'dark' || (mode === 'custom' && systemScheme === 'dark');

  if (mode === 'custom') {
    return {
      isDark,
      text: isDark ? '#e8e6f0' : '#1a1a2e',
      background: bgColor,
      tint: primaryColor,
      tabIconDefault: '#555',
      tabIconSelected: primaryColor,
      card: isDark ? '#1a1a2e' : '#ffffff',
      border: isDark ? '#2a2a40' : '#dce8e2',
      secondaryText: isDark ? '#9d9ab0' : '#6b7280',
      accent: isDark ? lighten(primaryColor, -120) : lighten(primaryColor, 140),
      surface: isDark ? '#252540' : '#f0fdf4',
    };
  }

  if (isDark) {
    return {
      isDark: true,
      text: '#e8e6f0',
      background: '#0f0f1a',
      tint: primaryColor,
      tabIconDefault: '#555',
      tabIconSelected: primaryColor,
      card: '#1a1a2e',
      border: '#2a2a40',
      secondaryText: '#9d9ab0',
      accent: lighten(primaryColor, -120),
      surface: '#252540',
    };
  }

  return {
    isDark: false,
    text: '#1a1a2e',
    background: '#f4faf7',
    tint: primaryColor,
    tabIconDefault: '#ccc',
    tabIconSelected: primaryColor,
    card: '#ffffff',
    border: '#dce8e2',
    secondaryText: '#6b7280',
    accent: lighten(primaryColor, 140),
    surface: '#f0fdf4',
  };
}
