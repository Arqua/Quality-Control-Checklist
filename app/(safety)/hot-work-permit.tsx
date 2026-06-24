import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

export default function HotWorkPermitScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [permitNumber, setPermitNumber] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [precautionsTaken, setPrecautionsTaken] = useState('');
  const [equipmentList, setEquipmentList] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!permitNumber.trim() || !workLocation.trim() || !workDescription.trim() ||
        !startDate.trim() || !endDate.trim() || !authorizedBy.trim() ||
        !precautionsTaken.trim() || !responsiblePerson.trim()) {
      notify({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    setSubmitting(true);
    try {
      await db.createHotWorkPermit({
        projectId,
        permitNumber: permitNumber.trim(),
        workLocation: workLocation.trim(),
        workDescription: workDescription.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        authorizedBy: authorizedBy.trim(),
        precautionsTaken: precautionsTaken.trim(),
        equipmentList: equipmentList.trim() || null,
        responsiblePerson: responsiblePerson.trim(),
      });

      notify({ type: 'success', message: 'Hot work permit created' });
      router.back();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create hot work permit' });
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
          Hot Work Permit
        </Text>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Permit Number *
          </Text>
          <TextInput
            placeholder="e.g., HWP-2024-001"
            value={permitNumber}
            onChangeText={setPermitNumber}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Work Location *
          </Text>
          <TextInput
            placeholder="Where will the hot work occur?"
            value={workLocation}
            onChangeText={setWorkLocation}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Work Description *
          </Text>
          <TextInput
            placeholder="Describe the hot work activities..."
            value={workDescription}
            onChangeText={setWorkDescription}
            multiline
            numberOfLines={4}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Start Date/Time *
          </Text>
          <TextInput
            placeholder="YYYY-MM-DD HH:MM"
            value={startDate}
            onChangeText={setStartDate}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            End Date/Time *
          </Text>
          <TextInput
            placeholder="YYYY-MM-DD HH:MM"
            value={endDate}
            onChangeText={setEndDate}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Authorized By *
          </Text>
          <TextInput
            placeholder="Name of person authorizing work"
            value={authorizedBy}
            onChangeText={setAuthorizedBy}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Safety Precautions Taken *
          </Text>
          <TextInput
            placeholder="List all precautions, fire watch arrangements, etc."
            value={precautionsTaken}
            onChangeText={setPrecautionsTaken}
            multiline
            numberOfLines={4}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Equipment List (Optional)
          </Text>
          <TextInput
            placeholder="Tools, equipment, materials to be used"
            value={equipmentList}
            onChangeText={setEquipmentList}
            multiline
            numberOfLines={3}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Responsible Person *
          </Text>
          <TextInput
            placeholder="Primary contact for this permit"
            value={responsiblePerson}
            onChangeText={setResponsiblePerson}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </ScrollView>

      <View
        className="bg-surface border-t border-line px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`py-3.5 px-4 rounded-xl flex-row items-center justify-center ${
            submitting ? 'bg-gray-300' : 'bg-construction-orange'
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base ml-2">Create Permit</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAwareView>
  );
}
