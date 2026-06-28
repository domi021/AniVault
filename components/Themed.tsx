import { Text as DefaultText, View as DefaultView } from 'react-native';
import { useColors } from '@/src/hooks/useColors';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

type ColorName = 'text' | 'background' | 'tint' | 'card' | 'border' | 'secondaryText' | 'accent' | 'surface';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorName
) {
  const colors = useColors();
  const colorFromProps = colors.isDark ? props.dark : props.light;

  if (colorFromProps) {
    return colorFromProps;
  }
  return colors[colorName];
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
