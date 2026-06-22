import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import SignatureScreen, {
  SignatureViewRef,
} from 'react-native-signature-canvas';
import { useChecklist } from '@/hooks/useChecklist';
import { useNotification } from '@/components/Notification';
import { capturePhoto, pickPhoto, PhotoResult } from '@/services/photos';
import { ItemStatus } from '@/types/database';

export default function InspectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const instanceId = params.instanceId as string;
  const { notify } = useNotification();

  const {
    instance,
    items,
    results,
    loading,
    syncing,
    error,
    updateItem,
    updateItemStatus,
    completeChecklist,
    clearError,
  } = useChecklist(instanceId);

  const [showSignOff, setShowSignOff] = useState(false);
  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [pmSignature, setPmSignature] = useState<string | null>(null);
  // Local, per-item comment buffer so typing doesn't hit SQLite on every keystroke.
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Surface hook errors as toasts.
  useEffect(() => {
    if (error) {
      notify({ type: 'error', message: error });
      clearError();
    }
  }, [error, notify, clearError]);

  const getItemResult = (itemId: string) => results.get(itemId);

  const getProgressStats = () => {
    const total = items.length;
    const values = Array.from(results.values());
    return {
      total,
      completed: values.length,
      passed: values.filter((r) => r.status === 'PASS').length,
      failed: values.filter((r) => r.status === 'FAIL').length,
    };
  };

  const handleStatusChange = (itemId: string, status: ItemStatus) => {
    updateItemStatus(itemId, status);
  };

  const persistComment = (itemId: string) => {
    const draft = commentDrafts[itemId];
    if (draft === undefined) return;
    const existing = getItemResult(itemId);
    if (!existing) return; // need a status first
    if ((existing.comments ?? '') === draft) return;
    updateItem(itemId, { comments: draft });
  };

  const handlePhoto = async (itemId: string, source: 'camera' | 'gallery') => {
    const existing = getItemResult(itemId);
    if (!existing) {
      notify({ type: 'info', message: 'Choose Pass / Fail / N/A before adding a photo' });
      return;
    }

    const result: PhotoResult =
      source === 'camera' ? await capturePhoto() : await pickPhoto();

    switch (result.status) {
      case 'ok':
        await updateItem(itemId, { photoUri: result.uri });
        notify({ type: 'success', message: 'Photo attached' });
        break;
      case 'denied':
        notify({
          type: 'error',
          message:
            source === 'camera'
              ? 'Camera permission denied. Enable it in Settings.'
              : 'Photo library permission denied. Enable it in Settings.',
        });
        break;
      case 'error':
        notify({ type: 'error', message: result.message });
        break;
      case 'cancelled':
      default:
        break;
    }
  };

  const handleRemovePhoto = (itemId: string) => {
    updateItem(itemId, { photoUri: null });
  };

  const handleOpenSignOff = () => {
    if (instance?.status === 'COMPLETED') {
      notify({ type: 'info', message: 'This checklist is already signed off' });
      return;
    }
    setInspectorSignature(null);
    setPmSignature(null);
    setShowSignOff(true);
  };

  const handleSubmitSignOff = async () => {
    if (!inspectorSignature) {
      notify({ type: 'error', message: 'Inspector signature is required' });
      return;
    }
    setSubmitting(true);
    try {
      await completeChecklist(inspectorSignature, pmSignature ?? undefined);
      setShowSignOff(false);
      notify({ type: 'success', message: 'Checklist signed off and completed' });
    } catch {
      notify({ type: 'error', message: 'Failed to sign off checklist' });
    } finally {
      setSubmitting(false);
    }
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
  const isCompleted = instance.status === 'COMPLETED';

  return (
    <View className="flex-1 bg-construction-light">
      {/* Progress Header */}
      <View className="bg-construction-dark px-4 py-4" style={{ paddingTop: insets.top + 10 }}>
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-white font-bold text-lg">{items.length} Items</Text>
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
          paddingBottom: insets.bottom + 90,
        }}
      >
        {items.map((item, index) => {
          const result = getItemResult(item.id);
          const draft = commentDrafts[item.id] ?? result?.comments ?? '';

          return (
            <View key={item.id} className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
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

              <Text className="text-gray-800 font-semibold text-sm mb-4 leading-5">
                {item.description_text}
              </Text>

              {/* Pass / Fail / N/A */}
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  disabled={isCompleted}
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
                      result?.status === 'PASS' ? 'text-green-700' : 'text-green-600'
                    }`}
                  >
                    PASS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isCompleted}
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
                      result?.status === 'FAIL' ? 'text-red-700' : 'text-red-600'
                    }`}
                  >
                    FAIL
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isCompleted}
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
                      result?.status === 'NA' ? 'text-gray-700' : 'text-gray-600'
                    }`}
                  >
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comments & Photo (only after a status is chosen) */}
              {result && (
                <View>
                  <TextInput
                    placeholder="Add comments or discrepancies..."
                    value={draft}
                    editable={!isCompleted}
                    onChangeText={(text) =>
                      setCommentDrafts((prev) => ({ ...prev, [item.id]: text }))
                    }
                    onBlur={() => persistComment(item.id)}
                    multiline
                    numberOfLines={2}
                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                    placeholderTextColor="#9CA3AF"
                  />

                  {result.photo_local_uri ? (
                    <View className="rounded-lg overflow-hidden border border-gray-300">
                      <Image
                        source={{ uri: result.photo_local_uri }}
                        style={{ width: '100%', height: 180 }}
                        resizeMode="cover"
                      />
                      <View className="flex-row items-center justify-between px-3 py-2 bg-gray-50">
                        <View className="flex-row items-center">
                          <MaterialIcons
                            name={
                              result.photo_sync_status === 'UPLOADED'
                                ? 'cloud-done'
                                : 'cloud-upload'
                            }
                            size={16}
                            color={
                              result.photo_sync_status === 'UPLOADED'
                                ? '#059669'
                                : '#6B7280'
                            }
                          />
                          <Text className="text-xs text-gray-600 ml-1">
                            {result.photo_sync_status === 'UPLOADED'
                              ? 'Uploaded'
                              : 'Pending upload'}
                          </Text>
                        </View>
                        {!isCompleted && (
                          <TouchableOpacity
                            onPress={() => handleRemovePhoto(item.id)}
                            className="flex-row items-center"
                          >
                            <MaterialIcons name="delete" size={16} color="#DC2626" />
                            <Text className="text-xs text-red-600 ml-1 font-semibold">
                              Remove
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : (
                    !isCompleted && (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => handlePhoto(item.id, 'camera')}
                          className="flex-1 bg-gray-100 rounded-lg py-3 border-2 border-dashed border-gray-400 flex-row items-center justify-center"
                        >
                          <MaterialIcons name="photo-camera" size={18} color="#6B7280" />
                          <Text className="text-gray-600 text-xs ml-2 font-semibold">
                            Camera
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handlePhoto(item.id, 'gallery')}
                          className="flex-1 bg-gray-100 rounded-lg py-3 border-2 border-dashed border-gray-400 flex-row items-center justify-center"
                        >
                          <MaterialIcons name="photo-library" size={18} color="#6B7280" />
                          <Text className="text-gray-600 text-xs ml-2 font-semibold">
                            Gallery
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Action */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleOpenSignOff}
          disabled={!isComplete || isCompleted}
          className={`py-3 px-4 rounded-lg flex-row items-center justify-center ${
            !isComplete || isCompleted ? 'bg-gray-300' : 'bg-construction-orange'
          }`}
        >
          <MaterialIcons
            name={isCompleted ? 'verified' : 'edit'}
            size={20}
            color={!isComplete || isCompleted ? '#9CA3AF' : 'white'}
          />
          <Text
            className={`font-bold text-base ml-2 ${
              !isComplete || isCompleted ? 'text-gray-600' : 'text-white'
            }`}
          >
            {isCompleted ? 'Signed Off' : 'Sign Off & Complete'}
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
          <View className="bg-white rounded-2xl w-full p-6 max-h-[92%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-construction-dark">
                Sign Off Checklist
              </Text>
              <TouchableOpacity onPress={() => setShowSignOff(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <SignaturePad
                label="Inspector Signature (required)"
                signed={!!inspectorSignature}
                onChange={setInspectorSignature}
              />
              <SignaturePad
                label="Project Manager Signature (optional)"
                signed={!!pmSignature}
                onChange={setPmSignature}
              />

              <View className="bg-blue-50 rounded-lg p-3 mb-2 border border-blue-200">
                <View className="flex-row">
                  <MaterialIcons name="info" size={16} color="#004E89" />
                  <Text className="text-xs text-construction-dark ml-2 flex-1">
                    Signatures are stored locally and synced to the backend when online.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-4 pt-4 border-t border-gray-200">
              <TouchableOpacity
                onPress={() => setShowSignOff(false)}
                className="flex-1 bg-gray-200 rounded-lg py-3 items-center"
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitSignOff}
                disabled={submitting}
                className={`flex-1 rounded-lg py-3 items-center ${
                  submitting ? 'bg-gray-300' : 'bg-construction-orange'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * A single signature capture surface backed by react-native-signature-canvas.
 * Emits a base64 PNG via `onChange` when captured, or `null` when cleared.
 */
function SignaturePad({
  label,
  signed,
  onChange,
}: {
  label: string;
  signed: boolean;
  onChange: (signature: string | null) => void;
}) {
  const ref = useRef<SignatureViewRef>(null);

  // Hide the library's default footer; we drive it with our own buttons.
  const webStyle = `
    .m-signature-pad--footer { display: none; margin: 0; }
    .m-signature-pad { box-shadow: none; border: none; }
    body, html { width: 100%; height: 100%; margin: 0; }
  `;

  return (
    <View className="mb-6">
      <Text className="font-bold text-construction-dark mb-2">{label}</Text>
      <View className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ height: 200 }}>
        <SignatureScreen
          ref={ref}
          onOK={(sig) => onChange(sig)}
          onEmpty={() => onChange(null)}
          webStyle={webStyle}
          backgroundColor="#ffffff"
          penColor="#000000"
        />
      </View>
      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-xs text-gray-600">
          {signed ? '✓ Captured' : 'Sign in the box above'}
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              ref.current?.clearSignature();
              onChange(null);
            }}
          >
            <Text className="text-xs font-semibold text-gray-600">Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => ref.current?.readSignature()}>
            <Text className="text-xs font-semibold text-construction-orange">
              Capture
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
