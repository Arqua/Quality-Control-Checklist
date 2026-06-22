import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Canvas, { CanvasRenderingContext2D } from 'react-native-canvas';
import { useChecklist } from '@/hooks/useChecklist';
import * as db from '@/database/db';
import { TemplateItem, ChecklistResult, ItemStatus } from '@/types/database';

const WINDOW_HEIGHT = Dimensions.get('window').height;

export default function InspectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const instanceId = params.instanceId as string;

  const {
    instance,
    items,
    results,
    loading,
    syncing,
    error,
    updateItemStatus,
    completeChecklist,
  } = useChecklist(instanceId);

  const [showSignOff, setShowSignOff] = useState(false);
  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [pmSignature, setPmSignature] = useState<string | null>(null);
  const canvasRef = useRef<Canvas>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isSigningInspector, setIsSigningInspector] = useState(true);

  const getItemResult = (itemId: string) => {
    return results.get(itemId);
  };

  const getProgressStats = () => {
    const total = items.length;
    const completed = Array.from(results.values()).length;
    const passed = Array.from(results.values()).filter(r => r.status === 'PASS').length;
    const failed = Array.from(results.values()).filter(r => r.status === 'FAIL').length;

    return { total, completed, passed, failed };
  };

  const handleStatusChange = async (itemId: string, status: ItemStatus) => {
    try {
      await updateItemStatus(itemId, status);
    } catch (error) {
      Alert.alert('Error', 'Failed to update item status');
    }
  };

  const handleAddComment = (itemId: string, comment: string) => {
    const result = getItemResult(itemId);
    if (result) {
      handleStatusChange(itemId, result.status);
    }
  };

  const handleOpenSignOff = () => {
    if (instance?.status === 'COMPLETED') {
      Alert.alert('Info', 'This checklist has already been signed off');
      return;
    }
    setShowSignOff(true);
    setIsSigningInspector(true);
  };

  const handleSubmitSignOff = async () => {
    if (!inspectorSignature && !pmSignature) {
      Alert.alert('Error', 'At least inspector signature is required');
      return;
    }

    try {
      const signature = inspectorSignature || 'No signature';
      await completeChecklist(signature, pmSignature || undefined);
      setShowSignOff(false);
      Alert.alert('Success', 'Checklist signed off and marked complete');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign off checklist');
    }
  };

  const handleDrawing = (x: number, y: number) => {
    if (!contextRef.current) return;

    const ctx = contextRef.current;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y + 1);
    ctx.stroke();
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  if (!instance) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-600">Checklist not found</Text>
      </View>
    );
  }

  const stats = getProgressStats();
  const progressPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const isComplete = stats.completed === stats.total && stats.total > 0;

  return (
    <View className="flex-1 bg-construction-light">
      {/* Progress Header */}
      <View className="bg-construction-dark px-4 py-4 pt-6" style={{ paddingTop: insets.top + 10 }}>
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-white font-bold text-lg">
              {items.length} Items
            </Text>
            <Text className="text-construction-light text-xs">
              {stats.passed} Pass • {stats.failed} Fail
            </Text>
          </View>
          {syncing && (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#FFB627" />
              <Text className="text-construction-light text-xs ml-2">Syncing...</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View className="bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
          <View
            className="bg-construction-accent h-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-construction-light text-xs">
          {stats.completed} of {stats.total} completed ({Math.round(progressPercent)}%)
        </Text>
      </View>

      {/* Checklist Items */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 12,
          paddingBottom: insets.bottom + 80,
        }}
      >
        {items.map((item, index) => {
          const result = getItemResult(item.id);

          return (
            <View
              key={item.id}
              className="bg-white rounded-lg p-4 mb-3 border border-gray-200"
            >
              {/* Item Number & Status */}
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-gray-500 text-xs font-semibold">
                  Item {index + 1} of {items.length}
                </Text>
                {result && (
                  <View
                    className="px-2 py-1 rounded-full"
                    style={{
                      backgroundColor:
                        result.status === 'PASS'
                          ? '#D1FAE520'
                          : result.status === 'FAIL'
                            ? '#FECACA20'
                            : '#E5E7EB20',
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{
                        color:
                          result.status === 'PASS'
                            ? '#059669'
                            : result.status === 'FAIL'
                              ? '#DC2626'
                              : '#6B7280',
                      }}
                    >
                      {result.status}
                    </Text>
                  </View>
                )}
              </View>

              {/* Description */}
              <Text className="text-gray-800 font-semibold text-sm mb-4 leading-5">
                {item.description_text}
              </Text>

              {/* Action Buttons */}
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => handleStatusChange(item.id, 'PASS')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 flex-row items-center justify-center ${
                    result?.status === 'PASS'
                      ? 'bg-green-100 border-green-500'
                      : 'bg-white border-green-300'
                  }`}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={16}
                    color={result?.status === 'PASS' ? '#059669' : '#10B981'}
                  />
                  <Text
                    className={`text-xs font-bold ml-1 ${
                      result?.status === 'PASS'
                        ? 'text-green-700'
                        : 'text-green-600'
                    }`}
                  >
                    PASS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleStatusChange(item.id, 'FAIL')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 flex-row items-center justify-center ${
                    result?.status === 'FAIL'
                      ? 'bg-red-100 border-red-500'
                      : 'bg-white border-red-300'
                  }`}
                >
                  <MaterialIcons
                    name="cancel"
                    size={16}
                    color={result?.status === 'FAIL' ? '#DC2626' : '#F87171'}
                  />
                  <Text
                    className={`text-xs font-bold ml-1 ${
                      result?.status === 'FAIL'
                        ? 'text-red-700'
                        : 'text-red-600'
                    }`}
                  >
                    FAIL
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleStatusChange(item.id, 'NA')}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 flex-row items-center justify-center ${
                    result?.status === 'NA'
                      ? 'bg-gray-200 border-gray-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <MaterialIcons
                    name="remove-circle"
                    size={16}
                    color={result?.status === 'NA' ? '#4B5563' : '#9CA3AF'}
                  />
                  <Text
                    className={`text-xs font-bold ml-1 ${
                      result?.status === 'NA'
                        ? 'text-gray-700'
                        : 'text-gray-600'
                    }`}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comments & Photo Section */}
              {result && (
                <View>
                  <TextInput
                    placeholder="Add comments or discrepancies..."
                    value={result.comments || ''}
                    onChangeText={text =>
                      handleAddComment(item.id, text)
                    }
                    multiline
                    numberOfLines={2}
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Photo Placeholder */}
                  <TouchableOpacity className="bg-gray-100 rounded-lg py-6 border-2 border-dashed border-gray-400 flex-row items-center justify-center">
                    <MaterialIcons name="photo-camera" size={20} color="#6B7280" />
                    <Text className="text-gray-600 text-sm ml-2">Add Photo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleOpenSignOff}
          disabled={!isComplete || instance.status === 'COMPLETED'}
          className={`py-3 px-4 rounded-lg flex-row items-center justify-center ${
            !isComplete || instance.status === 'COMPLETED'
              ? 'bg-gray-300'
              : 'bg-construction-orange'
          }`}
        >
          <MaterialIcons
            name="edit"
            size={20}
            color={!isComplete || instance.status === 'COMPLETED' ? '#9CA3AF' : 'white'}
          />
          <Text
            className={`font-bold text-base ml-2 ${
              !isComplete || instance.status === 'COMPLETED'
                ? 'text-gray-600'
                : 'text-white'
            }`}
          >
            Sign Off & Complete
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign-Off Modal */}
      <Modal
        visible={showSignOff}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSignOff(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-construction-dark">
                Sign Off Checklist
              </Text>
              <TouchableOpacity onPress={() => setShowSignOff(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Inspector Signature Section */}
              <View className="mb-6">
                <Text className="font-bold text-construction-dark mb-2">
                  Inspector Signature
                </Text>
                <View className="bg-gray-100 rounded-lg border-2 border-gray-300 h-48 overflow-hidden">
                  <View className="flex-1 bg-white">
                    <Text className="text-gray-500 text-center mt-20">
                      Signature canvas (placeholder)
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-gray-600 mt-2">
                  {inspectorSignature ? '✓ Signed' : 'Sign to proceed'}
                </Text>
              </View>

              {/* PM Signature Section */}
              <View className="mb-6">
                <Text className="font-bold text-construction-dark mb-2">
                  Project Manager Signature (Optional)
                </Text>
                <View className="bg-gray-100 rounded-lg border-2 border-gray-300 h-48 overflow-hidden">
                  <View className="flex-1 bg-white">
                    <Text className="text-gray-500 text-center mt-20">
                      Signature canvas (placeholder)
                    </Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                <View className="flex-row">
                  <MaterialIcons name="info" size={16} color="#004E89" />
                  <Text className="text-xs text-construction-dark ml-2 flex-1">
                    Both signatures will be stored locally and synced to the backend when online.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View className="flex-row gap-3 mt-4 pt-4 border-t border-gray-200">
              <TouchableOpacity
                onPress={() => setShowSignOff(false)}
                className="flex-1 bg-gray-200 rounded-lg py-3 items-center"
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitSignOff}
                className="flex-1 bg-construction-orange rounded-lg py-3 items-center"
              >
                <Text className="text-white font-bold">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
