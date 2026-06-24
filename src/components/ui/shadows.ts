import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-platform elevation presets. NativeWind's shadow utilities are
 * inconsistent across iOS/Android, so we express depth explicitly here and
 * reuse it through the UI primitives for a cohesive, modern feel.
 */
export const shadowCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;

export const shadowElevated: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 8 },
  default: {},
}) as ViewStyle;
