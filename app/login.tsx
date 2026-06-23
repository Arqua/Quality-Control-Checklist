import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/authContext';
import { useNotification } from '@/components/Notification';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { notify } = useNotification();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-construction-dark items-center justify-center px-6">
        {/* Header */}
        <View className="mb-12">
          <Text className="text-white text-4xl font-bold mb-2">
            QC Checklist
          </Text>
          <Text className="text-white text-base opacity-75">
            Construction Site Inspector
          </Text>
        </View>

        {/* Login Form */}
        <View className="w-full max-w-sm bg-white rounded-lg p-6 gap-4">
          <Text className="text-construction-dark text-xl font-bold mb-4">
            Login
          </Text>

          {/* Username Input */}
          <View>
            <Text className="text-construction-dark text-sm font-semibold mb-2">
              Username
            </Text>
            <TextInput
              className="bg-construction-light border border-construction-dark rounded-lg px-4 py-3 text-construction-dark"
              placeholder="Enter username"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              placeholderTextColor="#999"
            />
          </View>

          {/* Password Input */}
          <View>
            <Text className="text-construction-dark text-sm font-semibold mb-2">
              Password
            </Text>
            <TextInput
              className="bg-construction-light border border-construction-dark rounded-lg px-4 py-3 text-construction-dark"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              placeholderTextColor="#999"
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            className="bg-construction-orange rounded-lg py-3 mt-2"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-bold text-base">
                Login
              </Text>
            )}
          </TouchableOpacity>

          {/* Demo Credentials */}
          <View className="mt-6 pt-4 border-t border-construction-light">
            <Text className="text-construction-dark text-xs text-center mb-2">
              Demo Credentials:
            </Text>
            <Text className="text-construction-dark text-xs text-center font-semibold">
              Username: admin
            </Text>
            <Text className="text-construction-dark text-xs text-center font-semibold">
              Password: 1234
            </Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
