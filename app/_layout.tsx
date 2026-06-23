import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationProvider } from '@/components/Notification';
import { AuthProvider, useAuth } from '@/auth/authContext';
import { requestNotificationPermissions } from '@/services/notifications';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';

function RootLayoutContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Ask for notification permission once a user is signed in so HIGH-severity
  // events can surface as device notifications (works offline).
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermissions();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#004E89' }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="login" />
      ) : (
        <>
          <Stack.Screen name="(home)" />
          <Stack.Screen
            name="(inspection)"
            options={{ presentation: 'card' }}
          />
        </>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationProvider>
            <RootLayoutContent />
            <StatusBar style="light" />
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
