import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { shadowCard } from './shadows';

interface ActionTileProps {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  /** Accent color for the icon + its tinted chip background. */
  color: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * A square action shortcut: an elevated white card with a soft-tinted icon
 * chip and a label. Used for the home screen's safety / equipment grids.
 */
export const ActionTile: React.FC<ActionTileProps> = ({
  icon,
  label,
  color,
  onPress,
  disabled,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.85}
    className="flex-1 bg-surface rounded-2xl p-4 items-center"
    style={[shadowCard, disabled && { opacity: 0.45 }]}
  >
    <View
      className="w-12 h-12 rounded-2xl items-center justify-center mb-2.5"
      style={{ backgroundColor: `${color}1A` }}
    >
      <MaterialIcons name={icon} size={26} color={color} />
    </View>
    <Text className="text-ink font-semibold text-xs text-center leading-4">
      {label}
    </Text>
  </TouchableOpacity>
);
