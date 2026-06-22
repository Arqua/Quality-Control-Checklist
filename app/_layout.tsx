import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationProvider } from '@/components/Notification';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NotificationProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="(home)" />
            <Stack.Screen
              name="(inspection)"
              options={{ presentation: 'card' }}
            />
          </Stack>
          <StatusBar style="light" />
        </NotificationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
