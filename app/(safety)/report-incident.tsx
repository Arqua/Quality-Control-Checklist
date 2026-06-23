import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { useAuth } from '@/auth/authContext';
import { IncidentCategory, Severity } from '@/types/database';

const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string; icon: string }[] = [
  { value: 'INJURY_ILLNESS', label: 'Injury/Illness', icon: 'health-and-safety' },
  { value: 'MOTOR_VEHICLE', label: 'Motor Vehicle Accident', icon: 'directions-car' },
  { value: 'PROPERTY_DAMAGE', label: 'Property Damage', icon: 'broken-image' },
  { value: 'ENVIRONMENTAL_SPILL', label: 'Environmental Spill', icon: 'water-drop' },
  { value: 'LINE_STRIKE', label: 'Line Strike', icon: 'bolt' },
  { value: 'NEAR_MISS', label: 'Near Miss', icon: 'warning' },
];

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: '#FCD34D' },
  { value: 'MEDIUM', label: 'Medium', color: '#F97316' },
  { value: 'HIGH', label: 'High', color: '#DC2626' },
];

export default function ReportIncidentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { user } = useAuth();
  const { notify } = useNotification();

  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [involvedParties, setInvolvedParties] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleSubmitReport = async () => {
    if (!selectedCategory) {
      notify({ type: 'error', message: 'Please select an incident category' });
      return;
    }

    if (!description.trim()) {
      notify({ type: 'error', message: 'Please describe the incident' });
      return;
    }

    setSubmitting(true);
    try {
      const report = await db.createIncidentReport({
        projectId,
        category: selectedCategory,
        severity: selectedSeverity,
        description: description.trim(),
        location: location.trim() || null,
        dateTime: new Date().toISOString(),
        involvedParties: involvedParties.trim() || null,
        reporterName: user?.username ?? 'Unknown',
        correctiveActions: correctiveActions.trim() || null,
      });

      if (selectedSeverity === 'HIGH') {
        await db.createAlert({
          instanceId: projectId,
          resultId: report.id,
          projectId,
          title: `Workplace incident reported: ${
            INCIDENT_CATEGORIES.find((c) => c.value === selectedCategory)?.label
          }`,
          body: `${selectedSeverity} severity incident at ${location || 'unknown location'}. ${description.substring(0, 50)}...`,
          severity: 'HIGH',
        });
      }

      notify({ type: 'success', message: 'Incident report submitted' });
      router.back();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to submit incident report' });
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryLabel = INCIDENT_CATEGORIES.find(
    (c) => c.value === selectedCategory
  )?.label;

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
      >
        {/* Category Selection */}
        <View className="mb-6">
          <Text className="text-construction-dark font-bold text-base mb-3">
            Incident Category *
          </Text>
          <TouchableOpacity
            onPress={() => setShowCategoryPicker(true)}
            className="bg-white border-2 border-gray-300 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              {selectedCategory && (
                <MaterialIcons
                  name={
                    INCIDENT_CATEGORIES.find((c) => c.value === selectedCategory)?.icon ||
                    'warning'
                  }
                  size={24}
                  color="#004E89"
                  style={{ marginRight: 12 }}
                />
              )}
              <Text
                className={`text-base ${
                  selectedCategory ? 'text-construction-dark font-semibold' : 'text-gray-500'
                }`}
              >
                {selectedCategoryLabel || 'Select category...'}
              </Text>
            </View>
            <MaterialIcons name="expand-more" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Severity Selection */}
        <View className="mb-6">
          <Text className="text-construction-dark font-bold text-base mb-3">Severity *</Text>
          <View className="flex-row gap-3">
            {SEVERITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSelectedSeverity(opt.value)}
                className={`flex-1 rounded-lg py-3 px-2 items-center border-2 ${
                  selectedSeverity === opt.value
                    ? `border-construction-orange`
                    : 'border-gray-300'
                }`}
                style={{
                  backgroundColor:
                    selectedSeverity === opt.value ? `${opt.color}20` : '#FFFFFF',
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{
                    color: selectedSeverity === opt.value ? opt.color : '#6B7280',
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedSeverity === 'HIGH' && (
            <View className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <View className="flex-row items-start">
                <MaterialIcons name="warning" size={16} color="#DC2626" style={{ marginRight: 8 }} />
                <Text className="text-red-700 text-xs flex-1">
                  Management will be immediately notified of this incident.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-base mb-2">
            Description *
          </Text>
          <TextInput
            placeholder="Describe what happened in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Location */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-base mb-2">
            Location
          </Text>
          <TextInput
            placeholder="Where did this incident occur?"
            value={location}
            onChangeText={setLocation}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Involved Parties */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-base mb-2">
            Involved Parties
          </Text>
          <TextInput
            placeholder="Names and roles of people involved"
            value={involvedParties}
            onChangeText={setInvolvedParties}
            multiline
            numberOfLines={3}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Corrective Actions */}
        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-base mb-2">
            Corrective Actions (Optional)
          </Text>
          <TextInput
            placeholder="What steps will be taken to prevent recurrence?"
            value={correctiveActions}
            onChangeText={setCorrectiveActions}
            multiline
            numberOfLines={3}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleSubmitReport}
          disabled={submitting || !selectedCategory || !description.trim()}
          className={`py-3 px-4 rounded-lg flex-row items-center justify-center ${
            submitting || !selectedCategory || !description.trim()
              ? 'bg-gray-300'
              : 'bg-construction-orange'
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={20} color="white" />
              <Text className="text-white font-bold text-base ml-2">Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="border-b border-gray-200 px-4 py-4 flex-row justify-between items-center">
              <Text className="font-bold text-lg text-construction-dark">Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <MaterialIcons name="close" size={24} color="#004E89" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-4 py-4">
              {INCIDENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    setSelectedCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                  className="py-4 border-b border-gray-200 flex-row items-center"
                >
                  <MaterialIcons name={cat.icon} size={24} color="#004E89" />
                  <Text className="text-construction-dark font-semibold text-base ml-4 flex-1">
                    {cat.label}
                  </Text>
                  {selectedCategory === cat.value && (
                    <MaterialIcons name="check-circle" size={24} color="#059669" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
