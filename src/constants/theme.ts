// Paleta de colores oficial de ExLibris
export const ExLibrisColors = {
  primary: '#7B1E2B',        // Vino / Granate característico de ExLibris
  primaryDark: '#56131D',
  primaryLight: '#992B3B',
  primaryMuted: '#F4E7E9',
  
  background: '#F8F6F2',     // Tono papel cálido / pergamino
  surface: '#FFFFFF',
  surfaceVariant: '#F3EFEA',
  
  text: '#26211E',           // Café oscuro / carbón
  textSecondary: '#6E6660',
  textMuted: '#9E968F',
  textLight: '#FFFFFF',
  
  border: '#E8E2D9',
  borderDark: '#D5CCC0',
  
  gold: '#E39D28',           // Estrellas de calificación
  goldMuted: '#FCF3E3',
  
  moderator: '#1C4B37',      // Verde distintivo del Panel de Moderador
  moderatorLight: '#E8F3EE',
  
  danger: '#BA2D2D',         // Botón eliminar / alertas
  dangerLight: '#FBECEB',
  
  progress: '#3E7B54',       // Barra de progreso de lectura
  progressBg: '#E4DDD3',
};

// Medidas y espaciados oficiales de ExLibris
export const ExLibrisMetrics = {
  radiusSm: 6,
  radiusMd: 12,
  radiusLg: 18,
  radiusPill: 999,
  spacingXs: 4,
  spacingSm: 8,
  spacingMd: 16,
  spacingLg: 24,
  spacingXl: 32,
};

// Compatibilidad directa con la nomenclatura de trabajos anteriores (appMoviles)
export const globalColors = {
  ...ExLibrisColors,
  action: ExLibrisColors.primary,
  white: '#FFFFFF',
};

export const globalMedidas = {
  ...ExLibrisMetrics,
  margin: 16,
  padding: 16,
  textSizeTitle: 20,
};

// Compatibilidad con plantilla estándar de Expo
export const Colors = {
  light: {
    text: ExLibrisColors.text,
    background: ExLibrisColors.background,
    tint: ExLibrisColors.primary,
    icon: ExLibrisColors.textSecondary,
    tabIconDefault: ExLibrisColors.textSecondary,
    tabIconSelected: ExLibrisColors.primary,
  },
  dark: {
    text: '#FFFFFF',
    background: '#1A1817',
    tint: '#E8E2D9',
    icon: '#9E968F',
    tabIconDefault: '#9E968F',
    tabIconSelected: '#FFFFFF',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export default {
  ExLibrisColors,
  ExLibrisMetrics,
  globalColors,
  globalMedidas,
  Colors,
  Spacing,
};
