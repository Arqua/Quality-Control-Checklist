import React from 'react';
import { View, ViewProps } from 'react-native';
import { shadowCard, shadowElevated } from './shadows';

interface CardProps extends ViewProps {
  /** Use the deeper shadow for hero/standout surfaces. */
  elevated?: boolean;
  className?: string;
}

/**
 * The standard elevated surface for the app: a soft white card with large
 * rounded corners and a subtle drop shadow instead of a hard border.
 */
export const Card: React.FC<CardProps> = ({
  children,
  elevated,
  className = '',
  style,
  ...rest
}) => (
  <View
    className={`bg-surface rounded-2xl ${className}`}
    style={[elevated ? shadowElevated : shadowCard, style]}
    {...rest}
  >
    {children}
  </View>
);
