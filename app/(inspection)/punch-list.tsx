import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { PunchItem } from '@/types/database';

export default function PunchListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const instanceId = params.instanceId as string;
  const { notify } = useNotification();

  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  const loadPunchItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await db.getPunchItemsByInstance(instanceId);
      setPunchItems(items);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load punch items' });
    } finally {
      setLoading(false);
    }
  }, [instanceId, notify]);

  useFocusEffect(
    useCallback(() => {
      loadPunchItems();
    }, [loadPunchItems])
  );

  const handleAddItem = async () => {
    if (!newDescription.trim()) {
      notify({ type: 'info', message: 'Please enter a description' });
      return;
    }

    try {
      // Create punch item without a template_item_id (general punch item)
      // For simplicity, using a placeholder UUID
      const placeholderId = '00000000-0000-4000-8000-000000000000';
      await db.createPunchItem(instanceId, placeholderId, newDescription.trim());
      setNewDescription('');
      setShowNewItem(false);
      await loadPunchItems();
      notify({ type: 'success', message: 'Punch item added' });
    } catch (error) {
      notify({ type: 'error', message: 'Failed to add punch item' });
    }
  };

  const handleToggleStatus = async (item: PunchItem) => {
    try {
      const newStatus = item.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      await db.updatePunchItemStatus(item.id, newStatus);
      await loadPunchItems();
      notify({
        type: 'success',
        message: `Punch item marked ${newStatus.toLowerCase()}`,
      });
    } catch (error) {
      notify({ type: 'error', message: 'Failed to update punch item' });
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-construction-light">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <FlatList
        data={punchItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <MaterialIcons name="checklist" size={48} color="#ccc" />
            <Text className="text-construction-dark text-center mt-3 text-gray-500">
              No punch items yet. Add one to track tasks.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            className={`mb-3 rounded-lg p-4 ${
              item.status === 'OPEN'
                ? 'bg-red-50 border border-red-200'
                : 'bg-green-50 border border-green-200'
            }`}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text
                  className={`text-base font-semibold ${
                    item.status === 'OPEN' ? 'text-red-900' : 'text-green-900 line-through'
                  }`}
                >
                  {item.description}
                </Text>
                <Text className="text-xs text-gray-500 mt-2">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleToggleStatus(item)}
                className={`ml-3 rounded-full p-2 ${
                  item.status === 'OPEN'
                    ? 'bg-red-100'
                    : 'bg-green-100'
                }`}
              >
                <MaterialIcons
                  name={item.status === 'OPEN' ? 'check-circle-outline' : 'check-circle'}
                  size={24}
                  color={item.status === 'OPEN' ? '#dc2626' : '#16a34a'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Add Item Button */}
      <TouchableOpacity
        onPress={() => setShowNewItem(true)}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="flex-row items-center justify-center bg-construction-orange rounded-lg py-3">
          <MaterialIcons name="add-circle-outline" size={20} color="white" />
          <Text className="text-white font-bold text-base ml-2">Add Punch Item</Text>
        </View>
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal visible={showNewItem} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white rounded-t-2xl p-6"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-construction-dark font-bold text-lg">New Punch Item</Text>
              <TouchableOpacity onPress={() => setShowNewItem(false)}>
                <MaterialIcons name="close" size={24} color="#004E89" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Describe the task..."
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={4}
              className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 mb-4 text-construction-dark"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              onPress={handleAddItem}
              className="bg-construction-orange rounded-lg py-3"
            >
              <Text className="text-white font-bold text-center text-base">Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
