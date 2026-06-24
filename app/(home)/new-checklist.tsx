import { useEffect, useState } from 'react';
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
import { Template } from '@/types/database';

export default function NewChecklistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notify } = useNotification();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const templateId = params.templateId as string | undefined;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [inspectorName, setInspectorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templatesList = await db.getAllTemplates();
      setTemplates(templatesList);
      // Pre-select the template the user tapped "Start Inspection" on.
      if (templateId) {
        const preselected = templatesList.find((t) => t.id === templateId);
        if (preselected) setSelectedTemplate(preselected);
      }
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChecklist = async () => {
    if (!selectedTemplate) {
      notify({ type: 'info', message: 'Please select a template' });
      return;
    }

    if (!inspectorName.trim()) {
      notify({ type: 'info', message: 'Please enter inspector name' });
      return;
    }

    try {
      setCreating(true);
      const instance = await db.createChecklistInstance(
        projectId,
        selectedTemplate.id,
        inspectorName.trim()
      );

      router.replace({
        pathname: '/(inspection)',
        params: { instanceId: instance.id },
      });
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create checklist' });
      setCreating(false);
    }
  };

  const groupedByDivision = templates.reduce(
    (acc, template) => {
      const division = template.division;
      if (!acc[division]) {
        acc[division] = [];
      }
      acc[division].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <KeyboardAwareView>
    <View className="flex-1 bg-construction-light">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: 24,
        }}
      >
        {/* Inspector Name Input */}
        <View className="mb-6">
          <Text className="text-construction-dark font-bold text-lg mb-2">
            Inspector Name
          </Text>
          <TextInput
            placeholder="Enter your name"
            value={inspectorName}
            onChangeText={setInspectorName}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Template Selection */}
        <View>
          <Text className="text-construction-dark font-bold text-lg mb-3">
            Select Checklist Template
          </Text>

          {Object.entries(groupedByDivision).map(([division, divisionTemplates]) => (
            <View key={division} className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="flex-1 h-px bg-gray-300" />
                <Text className="text-gray-600 text-xs font-semibold px-3 uppercase">
                  {division}
                </Text>
                <View className="flex-1 h-px bg-gray-300" />
              </View>

              {divisionTemplates.map(template => (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => setSelectedTemplate(template)}
                  className={`rounded-lg p-4 mb-3 border-2 ${
                    selectedTemplate?.id === template.id
                      ? 'bg-blue-50 border-construction-dark'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text
                        className={`text-base font-semibold ${
                          selectedTemplate?.id === template.id
                            ? 'text-construction-dark'
                            : 'text-gray-700'
                        }`}
                      >
                        {template.name}
                      </Text>
                      <Text className="text-gray-500 text-xs mt-1">
                        {template.division}
                      </Text>
                    </View>
                    {selectedTemplate?.id === template.id && (
                      <MaterialIcons name="check-circle" size={24} color="#004E89" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer Button (in-flow so it rides above the keyboard) */}
      <View className="bg-white border-t border-gray-200 px-4 py-4"
        style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={handleCreateChecklist}
          disabled={creating || !selectedTemplate || !inspectorName.trim()}
          className={`py-3 px-4 rounded-lg flex-row items-center justify-center ${
            creating || !selectedTemplate || !inspectorName.trim()
              ? 'bg-gray-300'
              : 'bg-construction-orange'
          }`}
        >
          {creating ? (
            <ActivityIndicator size={20} color="white" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="white" />
              <Text className="text-white font-bold text-base ml-2">
                Create Checklist
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardAwareView>
  );
}
