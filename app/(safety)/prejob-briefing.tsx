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

export default function PreJobBriefingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [jobDescription, setJobDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [crewMembers, setCrewMembers] = useState('');
  const [identifiedHazards, setIdentifiedHazards] = useState('');
  const [controlMeasures, setControlMeasures] = useState('');
  const [ppeRequired, setPpeRequired] = useState('');
  const [emergencyProcedures, setEmergencyProcedures] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!jobDescription.trim() || !workLocation.trim() || !supervisor.trim() ||
        !crewMembers.trim() || !identifiedHazards.trim() ||
        !controlMeasures.trim() || !ppeRequired.trim()) {
      notify({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    setSubmitting(true);
    try {
      await db.createPreJobBriefing({
        projectId,
        jobDescription: jobDescription.trim(),
        workLocation: workLocation.trim(),
        supervisor: supervisor.trim(),
        crewMembers: crewMembers.trim(),
        identifiedHazards: identifiedHazards.trim(),
        controlMeasures: controlMeasures.trim(),
        ppeRequired: ppeRequired.trim(),
        emergencyProcedures: emergencyProcedures.trim() || null,
      });

      notify({ type: 'success', message: 'Pre-job briefing created' });
      router.back();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create pre-job briefing' });
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
          Pre-Job Safety Briefing
        </Text>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Job Description *
          </Text>
          <TextInput
            placeholder="Describe the work to be performed..."
            value={jobDescription}
            onChangeText={setJobDescription}
            multiline
            numberOfLines={3}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Work Location *
          </Text>
          <TextInput
            placeholder="Where will the work take place?"
            value={workLocation}
            onChangeText={setWorkLocation}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Supervisor *
          </Text>
          <TextInput
            placeholder="Name of supervisor conducting the briefing"
            value={supervisor}
            onChangeText={setSupervisor}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Crew Members *
          </Text>
          <TextInput
            placeholder="List all crew members present for the briefing"
            value={crewMembers}
            onChangeText={setCrewMembers}
            multiline
            numberOfLines={3}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Identified Hazards *
          </Text>
          <TextInput
            placeholder="List hazards identified for this job..."
            value={identifiedHazards}
            onChangeText={setIdentifiedHazards}
            multiline
            numberOfLines={4}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Control Measures *
          </Text>
          <TextInput
            placeholder="How will each hazard be controlled or mitigated?"
            value={controlMeasures}
            onChangeText={setControlMeasures}
            multiline
            numberOfLines={4}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            PPE Required *
          </Text>
          <TextInput
            placeholder="Required personal protective equipment"
            value={ppeRequired}
            onChangeText={setPpeRequired}
            multiline
            numberOfLines={2}
            className="bg-canvas border border-line rounded-xl px-4 py-3.5 text-ink"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="mb-4">
          <Text className="text-construction-dark font-bold text-sm mb-2">
            Emergency Procedures (Optional)
          </Text>
          <TextInput
            placeholder="Muster points, emergency contacts, first aid locations..."
            value={emergencyProcedures}
            onChangeText={setEmergencyProcedures}
            multiline
            numberOfLines={3}
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
              <Text className="text-white font-bold text-base ml-2">Create Briefing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAwareView>
  );
}
