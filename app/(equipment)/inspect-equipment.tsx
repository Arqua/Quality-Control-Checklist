import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

const EQUIPMENT_TYPES = [
  'Excavator',
  'Bulldozer',
  'Loader',
  'Grader',
  'Roller',
  'Compactor',
  'Crane',
  'Dump Truck',
  'Other',
];

interface Responses {
  engineCondition: boolean | null;
  hydraulicSystems: boolean | null;
  tiresTracks: boolean | null;
  lightsMirrors: boolean | null;
  safetyDevices: boolean | null;
  fluidLevels: boolean | null;
  structuralIntegrity: boolean | null;
  operatorControls: boolean | null;
}

interface InspectionQuestion {
  key: keyof Responses;
  label: string;
}

const INSPECTION_QUESTIONS: InspectionQuestion[] = [
  { key: 'engineCondition', label: 'Engine/Motor Condition' },
  { key: 'hydraulicSystems', label: 'Hydraulic Systems' },
  { key: 'tiresTracks', label: 'Tires/Tracks' },
  { key: 'lightsMirrors', label: 'Lights & Mirrors' },
  { key: 'safetyDevices', label: 'Safety Devices' },
  { key: 'fluidLevels', label: 'Fluid Levels' },
  { key: 'structuralIntegrity', label: 'Structural Integrity' },
  { key: 'operatorControls', label: 'Operator Controls' },
];

export default function InspectEquipmentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [equipmentNumber, setEquipmentNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState<Responses>({
    engineCondition: null,
    hydraulicSystems: null,
    tiresTracks: null,
    lightsMirrors: null,
    safetyDevices: null,
    fluidLevels: null,
    structuralIntegrity: null,
    operatorControls: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const toggleResponse = (key: keyof Responses) => {
    setResponses(prev => ({
      ...prev,
      [key]: prev[key] === true ? false : prev[key] === false ? null : true,
    }));
  };

  const handleSubmit = async () => {
    if (!equipmentNumber.trim()) {
      notify({ type: 'error', message: 'Please enter equipment number' });
      return;
    }
    if (!equipmentType) {
      notify({ type: 'error', message: 'Please select equipment type' });
      return;
    }
    if (!inspectorName.trim()) {
      notify({ type: 'error', message: 'Please enter inspector name' });
      return;
    }

    const anyAnswered = Object.values(responses).some(v => v !== null);
    if (!anyAnswered) {
      notify({ type: 'error', message: 'Please answer at least one question' });
      return;
    }

    setSubmitting(true);
    try {
      await db.createEquipmentInspection({
        projectId,
        equipmentNumber: equipmentNumber.trim(),
        equipmentType,
        inspectorName: inspectorName.trim(),
        photoUri,
        engineCondition: responses.engineCondition,
        hydraulicSystems: responses.hydraulicSystems,
        tiresTracks: responses.tiresTracks,
        lightsMirrors: responses.lightsMirrors,
        safetyDevices: responses.safetyDevices,
        fluidLevels: responses.fluidLevels,
        structuralIntegrity: responses.structuralIntegrity,
        operatorControls: responses.operatorControls,
        notes: notes.trim() || null,
      });

      notify({ type: 'success', message: 'Equipment inspection recorded' });
      router.back();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to save inspection' });
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareView>
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Text className="text-construction-dark font-bold text-lg mb-4">
          Equipment Inspection
        </Text>

        {/* Photo Section */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Equipment Photo (Optional)
          </Text>
          {photoUri ? (
            <View className="mb-3">
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 200, borderRadius: 8 }}
              />
              <TouchableOpacity
                onPress={() => setPhotoUri(null)}
                className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="delete" size={18} color="#DC2626" />
                <Text className="text-red-700 font-bold text-sm ml-2">Remove Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={handleTakePhoto}
                className="flex-1 bg-white border border-gray-300 rounded-lg p-3 flex-row items-center justify-center"
              >
                <MaterialIcons name="camera-alt" size={20} color="#004E89" />
                <Text className="text-construction-dark font-bold text-xs ml-2">
                  Take Photo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickPhoto}
                className="flex-1 bg-white border border-gray-300 rounded-lg p-3 flex-row items-center justify-center"
              >
                <MaterialIcons name="image" size={20} color="#004E89" />
                <Text className="text-construction-dark font-bold text-xs ml-2">
                  Pick Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Equipment Number */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Equipment Number *
          </Text>
          <TextInput
            placeholder="e.g., EXC-001"
            value={equipmentNumber}
            onChangeText={setEquipmentNumber}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Equipment Type */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Equipment Type *
          </Text>
          <TouchableOpacity
            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
          >
            <Text
              className={`${
                equipmentType ? 'text-construction-dark font-semibold' : 'text-gray-500'
              }`}
            >
              {equipmentType || 'Select equipment type...'}
            </Text>
            <MaterialIcons name="expand-more" size={24} color="#9CA3AF" />
          </TouchableOpacity>
          {showTypeDropdown && (
            <View className="bg-white border border-gray-300 border-t-0 rounded-b-lg">
              {EQUIPMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setEquipmentType(type);
                    setShowTypeDropdown(false);
                  }}
                  className={`px-4 py-3 border-b border-gray-200 ${
                    equipmentType === type ? 'bg-blue-50' : ''
                  }`}
                >
                  <Text
                    className={`${
                      equipmentType === type
                        ? 'text-construction-dark font-bold'
                        : 'text-gray-700'
                    }`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Inspector Name */}
        <View className="mb-6">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Inspector Name *
          </Text>
          <TextInput
            placeholder="Your name"
            value={inspectorName}
            onChangeText={setInspectorName}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Inspection Questions */}
        <Text className="text-construction-dark font-bold text-base mb-3">
          Equipment Readiness
        </Text>
        <Text className="text-gray-600 text-xs mb-4">
          Tap to cycle through: Not Answered → Yes → No → Not Answered
        </Text>

        {INSPECTION_QUESTIONS.map((question) => (
          <TouchableOpacity
            key={question.key}
            onPress={() => toggleResponse(question.key)}
            className={`mb-3 rounded-lg p-4 border-2 flex-row items-center justify-between ${
              responses[question.key] === true
                ? 'bg-green-50 border-green-300'
                : responses[question.key] === false
                ? 'bg-red-50 border-red-300'
                : 'bg-white border-gray-300'
            }`}
          >
            <Text className="text-construction-dark font-semibold text-sm flex-1">
              {question.label}
            </Text>
            {responses[question.key] === true && (
              <View className="bg-green-100 rounded-full p-2">
                <MaterialIcons name="check" size={20} color="#16a34a" />
              </View>
            )}
            {responses[question.key] === false && (
              <View className="bg-red-100 rounded-full p-2">
                <MaterialIcons name="close" size={20} color="#dc2626" />
              </View>
            )}
            {responses[question.key] === null && (
              <View className="bg-gray-100 rounded-full p-2">
                <MaterialIcons name="help" size={20} color="#6B7280" />
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Notes */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Additional Notes (Optional)
          </Text>
          <TextInput
            placeholder="Any observations or maintenance needed?"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </ScrollView>

      <View
        className="bg-white border-t border-gray-300 px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`py-3 px-4 rounded-lg flex-row items-center justify-center ${
            submitting ? 'bg-gray-300' : 'bg-construction-orange'
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base ml-2">Complete Inspection</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAwareView>
  );
}
