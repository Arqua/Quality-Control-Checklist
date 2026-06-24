import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/authContext';
import { useNotification } from '@/components/Notification';
import { Card, PrimaryButton } from '@/components/ui';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { notify } = useNotification();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!username || !password) {
      notify({ type: 'error', message: 'Please enter username and password' });
      return;
    }

    setLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        router.replace('/(home)');
      } else {
        notify({ type: 'error', message: 'Invalid username or password' });
      }
    } catch (error) {
      notify({ type: 'error', message: 'Login failed' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: 'username' | 'password') =>
    `bg-canvas border rounded-xl px-4 py-3.5 text-ink text-base ${
      focused === field ? 'border-brand-500' : 'border-line'
    }`;

  return (
    <LinearGradient
      colors={['#003C6B', '#004E89', '#0A6FB8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center px-6">
          {/* Brand mark */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-white/10 items-center justify-center mb-5 border border-white/15">
              <MaterialIcons name="engineering" size={34} color="#FF8A5C" />
            </View>
            <Text className="text-white text-4xl font-bold tracking-tight">
              Barnard
            </Text>
            <Text className="text-white/70 text-base mt-1">
              People building for People.
            </Text>
          </View>

          {/* Login card */}
          <Card elevated className="w-full max-w-sm p-7">
            <Text className="text-ink text-2xl font-bold mb-1">Welcome back</Text>
            <Text className="text-muted text-sm mb-6">
              Sign in to continue your inspections.
            </Text>

            <View className="mb-4">
              <Text className="text-ink text-sm font-semibold mb-2">Username</Text>
              <TextInput
                className={inputClass('username')}
                placeholder="Enter username"
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                editable={!loading}
                autoCapitalize="none"
                placeholderTextColor="#9AA7B8"
              />
            </View>

            <View className="mb-6">
              <Text className="text-ink text-sm font-semibold mb-2">Password</Text>
              <TextInput
                className={inputClass('password')}
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                editable={!loading}
                placeholderTextColor="#9AA7B8"
              />
            </View>

            <PrimaryButton
              label="Sign In"
              icon="login"
              loading={loading}
              onPress={handleLogin}
            />

            <View className="mt-6 pt-5 border-t border-line">
              <Text className="text-muted text-xs text-center mb-2 uppercase tracking-wider">
                Demo Credentials
              </Text>
              <View className="flex-row justify-center gap-2">
                <View className="bg-canvas rounded-lg px-3 py-1.5">
                  <Text className="text-ink text-xs font-semibold">admin</Text>
                </View>
                <View className="bg-canvas rounded-lg px-3 py-1.5">
                  <Text className="text-ink text-xs font-semibold">1234</Text>
                </View>
              </View>
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
