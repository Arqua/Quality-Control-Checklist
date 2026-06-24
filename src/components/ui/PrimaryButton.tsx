import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  TouchableOpacityProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { shadowCard } from './shadows';

interface PrimaryButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  /** 'accent' = orange (default), 'brand' = blue. */
  tone?: 'accent' | 'brand';
}

const GRADIENTS: Record<'accent' | 'brand', [string, string]> = {
  accent: ['#FF7E45', '#F2530F'],
  brand: ['#0A6FB8', '#004E89'],
};

/**
 * The app's primary call-to-action: a gradient pill button with an optional
 * leading icon, a loading state, and a disabled treatment.
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  loading,
  icon,
  tone = 'accent',
  disabled,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={isDisabled}
      style={[!isDisabled && shadowCard, style]}
      {...rest}
    >
      <LinearGradient
        colors={isDisabled ? ['#CBD5E1', '#CBD5E1'] : GRADIENTS[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16 }}
      >
        <View className="flex-row items-center justify-center py-4 px-4">
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              {icon && (
                <MaterialIcons
                  name={icon}
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text className="text-white font-bold text-base tracking-wide">
                {label}
              </Text>
            </>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};
