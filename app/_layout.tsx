import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        <Stack.Screen name="(home)" />
        <Stack.Screen
          name="(inspection)"
          options={{
            animationEnabled: true,
            presentation: 'card',
          }}
        />
      </Stack>
      <StatusBar barStyle="light-content" />
    </GestureHandlerRootView>
  );
}
