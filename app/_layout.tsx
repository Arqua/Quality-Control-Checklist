import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationProvider } from '@/components/Notification';
import { AuthProvider, useAuth } from '@/auth/authContext';
import { I18nProvider } from '@/locales/i18nContext';
import { requestNotificationPermissions } from '@/services/notifications';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';

function RootLayoutContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Auth gate. The app has no `app/index.tsx`, so the root route `/` resolves
  // to `(home)/index` (route groups don't add to the URL). Conditionally
  // declaring screens is not enough to block that, so we explicitly redirect:
  // unauthenticated users are sent to /login, and a freshly authenticated user
  // sitting on /login is sent into the app.
  useEffect(() => {
    if (isLoading) return;
    const onLoginScreen = segments[0] === 'login';
    if (!isAuthenticated && !onLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && onLoginScreen) {
      router.replace('/(home)');
    }
  }, [isAuthenticated, isLoading, segments]);

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

  // Declare every screen unconditionally so navigation targets always exist;
  // the effect above enforces which one the user is allowed to be on.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="(home)" />
      <Stack.Screen
        name="(inspection)"
        options={{ presentation: 'card' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <NotificationProvider>
              <RootLayoutContent />
              <StatusBar style="light" />
            </NotificationProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
