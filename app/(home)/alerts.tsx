import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useAuth } from '@/auth/authContext';
import { useNotification } from '@/components/Notification';
import { Card } from '@/components/ui';
import { Alert, Severity } from '@/types/database';

const SEVERITY_STYLE: Record<Severity, { bg: string; label: string }> = {
  LOW: { bg: 'bg-yellow-500', label: 'LOW' },
  MEDIUM: { bg: 'bg-construction-orange', label: 'MEDIUM' },
  HIGH: { bg: 'bg-red-600', label: 'HIGH' },
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isManager } = useAuth();
  const { notify } = useNotification();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.getAlerts();
      setAlerts(data);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load alerts' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const handleAcknowledge = async (id: string) => {
    try {
      await db.acknowledgeAlert(id);
      await loadAlerts();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to acknowledge' });
    }
  };

  // Management-only screen.
  if (!isManager) {
    return (
      <View className="flex-1 bg-construction-light items-center justify-center p-6" style={{ paddingTop: insets.top }}>
        <MaterialIcons name="lock" size={48} color="#ccc" />
        <Text className="text-construction-dark text-center mt-3">
          Management access required to view alerts.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-construction-light items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      {alerts.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="notifications-none" size={48} color="#ccc" />
          <Text className="text-construction-dark text-center mt-3">
            No alerts. Serious (high-severity) events will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            const sev = SEVERITY_STYLE[item.severity];
            return (
              <Card
                elevated
                className={`mb-3 border-l-4 ${
                  item.acknowledged ? 'border-gray-300' : 'border-red-600'
                }`}
              >
                <View className="p-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className={`${sev.bg} rounded px-2 py-1`}>
                      <Text className="text-white text-xs font-bold">
                        {sev.label}
                      </Text>
                    </View>
                    <Text className="text-construction-dark text-xs opacity-60">
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>

                  <Text className="text-construction-dark font-bold text-base">
                    {item.title}
                  </Text>
                  <Text className="text-construction-dark text-sm opacity-80 mt-1">
                    {item.body}
                  </Text>

                  {!item.acknowledged && (
                    <TouchableOpacity
                      onPress={() => handleAcknowledge(item.id)}
                      className="bg-brand-500 rounded-xl py-2.5 mt-3"
                    >
                      <Text className="text-white text-center font-bold text-sm">
                        Acknowledge
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
