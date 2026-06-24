import React from 'react';
import {
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  Platform,
  StyleSheet,
} from 'react-native';

/**
 * Wraps a form screen so the focused input (and a bottom action footer) is
 * lifted above the on-screen keyboard instead of being hidden behind it.
 *
 * Pair this with the screen layout pattern:
 *   <KeyboardAwareView>
 *     <View className="flex-1" style={{ paddingTop: insets.top }}>
 *       <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">…</ScrollView>
 *       <View style={{ paddingBottom: insets.bottom + 12 }}>…footer button…</View>
 *     </View>
 *   </KeyboardAwareView>
 *
 * The footer must be a normal in-flow child (NOT absolutely positioned) so it
 * rides up with the shrinking container; an absolute footer stays pinned to the
 * container bottom and ends up behind the keyboard.
 */
export const KeyboardAwareView: React.FC<KeyboardAvoidingViewProps> = ({
  children,
  style,
  ...rest
}) => (
  <KeyboardAvoidingView
    style={[styles.flex, style]}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    {...rest}
  >
    {children}
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
