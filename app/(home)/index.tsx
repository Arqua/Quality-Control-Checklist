import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { runSync } from '@/services/sync';
import { useNotification } from '@/components/Notification';
import { Project, ChecklistInstance } from '@/types/database';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notify } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeChecklists, setActiveChecklists] = useState<ChecklistInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsList = await db.getAllProjects();
      setProjects(projectsList);

      if (projectsList.length > 0) {
        selectProject(projectsList[0]);
      }
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load projects' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (project: Project) => {
    setSelectedProject(project);
    try {
      const checklists = await db.getChecklistInstancesByProject(project.id);
      setActiveChecklists(checklists);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load checklists' });
    }
  };

  const handleNewChecklist = () => {
    if (!selectedProject) {
      notify({ type: 'info', message: 'Please select a project first' });
      return;
    }
    router.push({
      pathname: '/(home)/new-checklist',
      params: { projectId: selectedProject.id },
    });
  };

  const handleOpenChecklist = (checklist: ChecklistInstance) => {
    router.push({
      pathname: '/(inspection)',
      params: { instanceId: checklist.id },
    });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const result = await runSync();

      if (!result.ok) {
        notify({
          type: 'error',
          message: result.reason ?? 'Sync failed — will retry automatically',
        });
      } else if (
        result.syncedResults === 0 &&
        result.syncedPunchItems === 0 &&
        result.uploadedPhotos === 0 &&
        result.syncedInstances === 0
      ) {
        notify({ type: 'info', message: 'Everything is already up to date' });
      } else {
        notify({
          type: 'success',
          message: `Synced ${result.syncedResults} results, ${result.syncedPunchItems} punch items, ${result.uploadedPhotos} photos`,
        });
        if (selectedProject) {
          const checklists = await db.getChecklistInstancesByProject(
            selectedProject.id
          );
          setActiveChecklists(checklists);
        }
      }
    } catch (error) {
      notify({ type: 'error', message: 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  const getChecklistStatus = (checklist: ChecklistInstance) => {
    if (checklist.status === 'COMPLETED') {
      return { label: 'Completed', color: '#10B981', icon: 'check-circle' };
    }
    return { label: 'Draft', color: '#F59E0B', icon: 'edit' };
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-construction-dark px-4 py-4">
        <Text className="text-white text-2xl font-bold">QC Checklist</Text>
        <Text className="text-construction-light text-sm mt-1">Construction Site Inspector</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {/* Project Selector */}
        {projects.length > 0 && (
          <View className="mb-6">
            <Text className="text-construction-dark font-bold text-lg mb-3">
              Select Project
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {projects.map(project => (
                <TouchableOpacity
                  key={project.id}
                  onPress={() => selectProject(project)}
                  className={`mr-3 px-4 py-3 rounded-lg border-2 ${
                    selectedProject?.id === project.id
                      ? 'bg-construction-orange border-construction-orange'
                      : 'bg-white border-construction-dark'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedProject?.id === project.id
                        ? 'text-white'
                        : 'text-construction-dark'
                    }`}
                  >
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Current Project Info */}
        {selectedProject && (
          <View className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-gray-600 text-xs uppercase tracking-wide">
                  Current Project
                </Text>
                <Text className="text-construction-dark text-lg font-bold mt-1">
                  {selectedProject.name}
                </Text>
                <Text className="text-gray-600 text-sm mt-1">{selectedProject.location}</Text>
              </View>
              <MaterialIcons name="location-on" size={24} color="#FF6B35" />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={handleNewChecklist}
            className="flex-1 bg-construction-orange px-4 py-3 rounded-lg flex-row items-center justify-center"
          >
            <MaterialIcons name="add" size={20} color="white" />
            <Text className="text-white font-bold text-sm ml-2">New Checklist</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncing}
            className={`px-4 py-3 rounded-lg border-2 border-construction-dark ${
              syncing ? 'opacity-50' : ''
            }`}
          >
            {syncing ? (
              <ActivityIndicator size={20} color="#004E89" />
            ) : (
              <MaterialIcons name="sync" size={20} color="#004E89" />
            )}
          </TouchableOpacity>
        </View>

        {/* Active Checklists */}
        <View>
          <Text className="text-construction-dark font-bold text-lg mb-3">
            Checklists ({activeChecklists.length})
          </Text>

          {activeChecklists.length === 0 ? (
            <View className="bg-white rounded-lg p-8 items-center border border-gray-200">
              <MaterialIcons name="assignment" size={40} color="#D1D5DB" />
              <Text className="text-gray-500 text-sm mt-3 text-center">
                No checklists yet. Create a new one to get started.
              </Text>
            </View>
          ) : (
            activeChecklists.map(checklist => {
              const statusInfo = getChecklistStatus(checklist);
              return (
                <TouchableOpacity
                  key={checklist.id}
                  onPress={() => handleOpenChecklist(checklist)}
                  className="bg-white rounded-lg p-4 mb-3 border border-gray-200 active:bg-gray-50"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-construction-dark font-semibold text-sm">
                        Created {new Date(checklist.created_at).toLocaleDateString()}
                      </Text>
                      <Text className="text-gray-600 text-xs mt-1">
                        Inspector: {checklist.inspector_name}
                      </Text>
                    </View>
                    <View
                      className="px-2 py-1 rounded-full flex-row items-center"
                      style={{ backgroundColor: `${statusInfo.color}20` }}
                    >
                      <MaterialIcons
                        name={statusInfo.icon as any}
                        size={14}
                        color={statusInfo.color}
                      />
                      <Text
                        className="text-xs font-semibold ml-1"
                        style={{ color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center mt-3">
                    <MaterialIcons name="arrow-forward" size={16} color="#004E89" />
                    <Text className="text-construction-dark text-xs font-semibold ml-1">
                      Open
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
