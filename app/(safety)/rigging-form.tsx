import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

export default function RiggingFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [riggingNumber, setRiggingNumber] = useState('');
  const [loadDescription, setLoadDescription] = useState('');
  const [loadWeight, setLoadWeight] = useState('');
  const [riggingPlan, setRiggingPlan] = useState('');
  const [inspectedBy, setInspectedBy] = useState('');
  const [certificationNumber, setCertificationNumber] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [areaSecured, setAreaSecured] = useState(false);
  const [personnelBriefed, setPersonnelBriefed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!riggingNumber.trim() || !loadDescription.trim() || !loadWeight.trim() ||
        !riggingPlan.trim() || !inspectedBy.trim() || !certificationNumber.trim()) {
      notify({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    const weight = parseFloat(loadWeight);
    if (isNaN(weight) || weight <= 0) {
      notify({ type: 'error', message: 'Load weight must be a valid positive number' });
      return;
    }

    setSubmitting(true);
    try {
      await db.createRiggingForm({
        projectId,
        riggingNumber: riggingNumber.trim(),
        loadDescription: loadDescription.trim(),
        loadWeight: weight,
        riggingPlan: riggingPlan.trim(),
        inspectedBy: inspectedBy.trim(),
        certificationNumber: certificationNumber.trim(),
        weatherConditions: weatherConditions.trim() || null,
        areaSecured,
        personnelBriefed,
      });

      notify({ type: 'success', message: 'Rigging form created' });
      router.back();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create rigging form' });
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
          Rigging Form
        </Text>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Rigging Form Number *
          </Text>
          <TextInput
            placeholder="e.g., RIG-2024-001"
            value={riggingNumber}
            onChangeText={setRiggingNumber}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Load Description *
          </Text>
          <TextInput
            placeholder="What is being lifted?"
            value={loadDescription}
            onChangeText={setLoadDescription}
            multiline
            numberOfLines={3}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Load Weight (in kg) *
          </Text>
          <TextInput
            placeholder="e.g., 5000"
            value={loadWeight}
            onChangeText={setLoadWeight}
            keyboardType="decimal-pad"
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Rigging Plan *
          </Text>
          <TextInput
            placeholder="Describe the rigging setup, equipment, lifting method..."
            value={riggingPlan}
            onChangeText={setRiggingPlan}
            multiline
            numberOfLines={4}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Inspected By *
          </Text>
          <TextInput
            placeholder="Name of qualified inspector"
            value={inspectedBy}
            onChangeText={setInspectedBy}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Certification Number *
          </Text>
          <TextInput
            placeholder="Inspector's certification number"
            value={certificationNumber}
            onChangeText={setCertificationNumber}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Weather Conditions (Optional)
          </Text>
          <TextInput
            placeholder="Current weather conditions"
            value={weatherConditions}
            onChangeText={setWeatherConditions}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <View className="flex-row items-center justify-between bg-white rounded-lg p-4 border border-gray-300">
            <Text className="text-construction-dark font-bold text-sm">Work Area Secured</Text>
            <Switch
              value={areaSecured}
              onValueChange={setAreaSecured}
              trackColor={{ false: '#e5e5e5', true: '#FFA500' }}
              thumbColor={areaSecured ? '#FF6B35' : '#f4f3f4'}
            />
          </View>
        </View>

        <View className="mb-4">
          <View className="flex-row items-center justify-between bg-white rounded-lg p-4 border border-gray-300">
            <Text className="text-construction-dark font-bold text-sm">Personnel Briefed</Text>
            <Switch
              value={personnelBriefed}
              onValueChange={setPersonnelBriefed}
              trackColor={{ false: '#e5e5e5', true: '#FFA500' }}
              thumbColor={personnelBriefed ? '#FF6B35' : '#f4f3f4'}
            />
          </View>
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
              <Text className="text-white font-bold text-base ml-2">Create Form</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAwareView>
  );
}
