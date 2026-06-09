import React from 'react';
import { useColorScheme } from 'react-native';

/** Calm administrative palette — no medical-blue cliché. */
export const light = {
  bg: '#F5F4F1', surface: '#FFFFFF', surfaceAlt: '#ECEAE5', line: '#DCD9D2',
  text: '#17181A', textDim: '#61646B', textFaint: '#8E9198',
  accent: '#2F5D50', accentDeep: '#1C3A31', accentSoft: '#E3EDE8',
  danger: '#B4483C', warning: '#B57A2E', good: '#3F7A55',
};
export type Palette = typeof light;

export const dark: Palette = {
  bg: '#121315', surface: '#1B1D20', surfaceAlt: '#25282C', line: '#31353A',
  text: '#ECEDEF', textDim: '#A0A4AB', textFaint: '#6E727A',
  accent: '#7FB8A4', accentDeep: '#A9D4C4', accentSoft: '#1E2C27',
  danger: '#D98077', warning: '#D2A35F', good: '#82B896',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const c = useColors();
  return React.useMemo(() => factory(c), [c, factory]);
}

export const font = {
  display: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  med: 'Inter_500Medium',
} as const;

export const spacing = (n: number) => n * 4;
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;
