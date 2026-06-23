import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import * as db from '@/database/db';
import { runSync } from '@/services/sync';
import { useNotification } from '@/components/Notification';
import { useAuth } from '@/auth/authContext';
import { Project, Template, ChecklistInstance } from '@/types/database';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, isManager, user } = useAuth();
  const { notify } = useNotification();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeChecklists, setActiveChecklists] = useState<ChecklistInstance[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'completed'>('all');

  // Modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDivision, setTemplateDivision] = useState('');
  const [templateItems, setTemplateItems] = useState<string[]>(['', '', '']);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const projectsList = await db.getAllProjects();
      setProjects(projectsList);

      if (isManager) {
        setUnreadAlerts(await db.getUnacknowledgedAlertCount());
      }

      if (projectsList.length > 0) {
        const current =
          projectsList.find((p) => p.id === selectedProject?.id) ?? projectsList[0];
        await selectProject(current);
      } else {
        setSelectedProject(null);
        setTemplates([]);
        setActiveChecklists([]);
      }
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load data' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectProject = async (project: Project) => {
    setSelectedProject(project);
    try {
      const [templatesData, checklistsData] = await Promise.all([
        db.getAllTemplates(),
        db.getChecklistInstancesByProject(project.id),
      ]);
      setTemplates(templatesData);
      setActiveChecklists(checklistsData);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load project data' });
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim() || !projectLocation.trim()) {
      notify({ type: 'error', message: 'Please fill in all fields' });
      return;
    }
    try {
      await db.createProject(projectName.trim(), projectLocation.trim());
      setProjectName('');
      setProjectLocation('');
      setShowProjectModal(false);
      notify({ type: 'success', message: 'Project created' });
      await loadData();
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create project' });
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !templateDivision.trim()) {
      notify({ type: 'error', message: 'Please fill in template details' });
      return;
    }
    const items = templateItems.map((i) => i.trim()).filter(Boolean);
    if (items.length === 0) {
      notify({ type: 'error', message: 'Add at least one checklist item' });
      return;
    }
    try {
      const tmpl = await db.createTemplate(templateName.trim(), templateDivision.trim());
      for (let i = 0; i < items.length; i++) {
        await db.createTemplateItem(tmpl.id, items[i], i);
      }
      setTemplateName('');
      setTemplateDivision('');
      setTemplateItems(['', '', '']);
      setShowTemplateModal(false);
      notify({ type: 'success', message: 'Template created' });
      if (selectedProject) await selectProject(selectedProject);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to create template' });
    }
  };

  const handleStartInspection = (templateId: string) => {
    if (!selectedProject) {
      notify({ type: 'error', message: 'Select a project first' });
      return;
    }
    router.push({
      pathname: '/(home)/new-checklist',
      params: { projectId: selectedProject.id, templateId },
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
        notify({ type: 'error', message: result.reason ?? 'Sync failed' });
      } else {
        notify({ type: 'success', message: 'Sync complete' });
        if (selectedProject) await selectProject(selectedProject);
      }
    } catch (error) {
      notify({ type: 'error', message: 'Sync failed' });
    } finally {
      setSyncing(false);
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
      {/* Header */}
      <View className="bg-construction-dark px-4 py-4">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">QC Checklist</Text>
            <Text className="text-white text-sm opacity-75">
              {isManager ? 'Management Mode' : 'Construction Site Inspector'}
              {user ? ` · ${user.username}` : ''}
            </Text>
          </View>

          {/* Manager-only alerts bell */}
          {isManager && (
            <TouchableOpacity
              onPress={() => router.push('/(home)/alerts')}
              className="p-2 mr-1"
            >
              <MaterialIcons name="notifications" size={26} color="white" />
              {unreadAlerts > 0 && (
                <View className="absolute right-0 top-0 bg-red-600 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-white text-[10px] font-bold">
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push('/(home)/activity-log')}
            className="p-2 mr-1"
          >
            <MaterialIcons name="history" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(home)/settings')}
            className="p-2 mr-1"
          >
            <MaterialIcons name="settings" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} className="p-2">
            <AntDesign name="logout" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setShowProjectModal(true)}
            className="flex-1 bg-construction-orange rounded-lg py-3"
          >
            <View className="flex-row items-center justify-center">
              <MaterialIcons name="add" size={20} color="white" />
              <Text className="text-white font-bold ml-1">New Project</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncing}
            className="border border-white rounded-lg px-3 py-3"
          >
            {syncing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="sync" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        {/* Management banner */}
        {isManager && unreadAlerts > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(home)/alerts')}
            className="bg-red-600 rounded-lg p-4 mb-4 flex-row items-center"
          >
            <MaterialIcons name="warning" size={24} color="white" />
            <Text className="text-white font-bold ml-2 flex-1">
              {unreadAlerts} serious event{unreadAlerts > 1 ? 's' : ''} need attention
            </Text>
            <MaterialIcons name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
        )}

        {/* Search and Filter */}
        <View className="mb-4">
          <TextInput
            placeholder="Search projects..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 mb-3 text-construction-dark"
            placeholderTextColor="#9CA3AF"
          />
          <View className="flex-row gap-2">
            {(['all', 'active', 'completed'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setFilterBy(filter)}
                className={`flex-1 rounded-lg py-2 px-3 ${
                  filterBy === filter ? 'bg-construction-orange' : 'bg-white border border-gray-300'
                }`}
              >
                <Text
                  className={`text-center text-xs font-bold ${
                    filterBy === filter ? 'text-white' : 'text-construction-dark'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Projects */}
        <Text className="text-construction-dark text-lg font-bold mb-3">
          Projects ({projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length})
        </Text>
        {projects.length === 0 ? (
          <View className="bg-white rounded-lg p-6 items-center mb-6">
            <MaterialIcons name="folder-open" size={48} color="#ccc" />
            <Text className="text-construction-dark text-center mt-3">
              No projects yet. Create one to get started.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {projects
              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((project) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => selectProject(project)}
                className={`mb-2 p-4 rounded-lg border-2 ${
                  selectedProject?.id === project.id
                    ? 'bg-construction-dark border-construction-orange'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`font-bold text-base ${
                    selectedProject?.id === project.id ? 'text-white' : 'text-construction-dark'
                  }`}
                >
                  {project.name}
                </Text>
                <Text
                  className={`text-sm ${
                    selectedProject?.id === project.id
                      ? 'text-white opacity-75'
                      : 'text-gray-600'
                  }`}
                >
                  {project.location}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Templates */}
        {selectedProject && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-construction-dark text-lg font-bold">
                Templates ({templates.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowTemplateModal(true)}
                className="bg-construction-orange rounded px-3 py-1 flex-row items-center"
              >
                <MaterialIcons name="add" size={18} color="white" />
                <Text className="text-white font-bold text-xs ml-1">New</Text>
              </TouchableOpacity>
            </View>

            {templates.length === 0 ? (
              <View className="bg-white rounded-lg p-6 items-center">
                <MaterialIcons name="description" size={48} color="#ccc" />
                <Text className="text-construction-dark text-center mt-3">
                  No templates yet. Create one to start inspections.
                </Text>
              </View>
            ) : (
              templates.map((tmpl) => (
                <View key={tmpl.id} className="mb-3 bg-white rounded-lg p-4">
                  <Text className="text-construction-dark font-bold text-base">
                    {tmpl.name}
                  </Text>
                  <Text className="text-gray-600 text-sm">{tmpl.division}</Text>
                  <TouchableOpacity
                    onPress={() => handleStartInspection(tmpl.id)}
                    className="bg-construction-orange rounded py-2 mt-3"
                  >
                    <Text className="text-white text-center font-bold">
                      Start Inspection
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* Active checklists */}
        {selectedProject && activeChecklists.length > 0 && (
          <View>
            <Text className="text-construction-dark text-lg font-bold mb-3">
              Checklists ({activeChecklists
                .filter(c => {
                  const matchesFilter = filterBy === 'all' ||
                    (filterBy === 'active' && c.status === 'DRAFT') ||
                    (filterBy === 'completed' && c.status === 'COMPLETED');
                  const matchesSearch = c.inspector_name.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchesFilter && matchesSearch;
                })
                .length})
            </Text>
            {activeChecklists
              .filter(c => {
                const matchesFilter = filterBy === 'all' ||
                  (filterBy === 'active' && c.status === 'DRAFT') ||
                  (filterBy === 'completed' && c.status === 'COMPLETED');
                const matchesSearch = c.inspector_name.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesFilter && matchesSearch;
              })
              .map((checklist) => (
              <TouchableOpacity
                key={checklist.id}
                onPress={() => handleOpenChecklist(checklist)}
                className="mb-2 bg-white rounded-lg p-4 border-l-4 border-construction-orange"
              >
                <Text className="text-construction-dark font-semibold text-sm">
                  Created {new Date(checklist.created_at).toLocaleDateString()}
                </Text>
                <Text className="text-gray-600 text-xs mt-1">
                  Inspector: {checklist.inspector_name}
                </Text>
                <View className="flex-row items-center mt-2">
                  <View
                    className={`rounded px-2 py-1 ${
                      checklist.status === 'COMPLETED'
                        ? 'bg-green-600'
                        : 'bg-construction-orange'
                    }`}
                  >
                    <Text className="text-white text-xs font-bold">
                      {checklist.status === 'COMPLETED' ? 'Completed' : 'Draft'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Project Modal */}
      <Modal
        visible={showProjectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-construction-dark text-xl font-bold">
                New Project
              </Text>
              <TouchableOpacity onPress={() => setShowProjectModal(false)}>
                <MaterialIcons name="close" size={24} color="#004E89" />
              </TouchableOpacity>
            </View>
            <Text className="text-construction-dark font-semibold mb-2">
              Project Name
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 bg-construction-light mb-4"
              placeholder="e.g., Downtown Office Tower"
              value={projectName}
              onChangeText={setProjectName}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-construction-dark font-semibold mb-2">Location</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 bg-construction-light mb-4"
              placeholder="e.g., Block A - 123 Main St"
              value={projectLocation}
              onChangeText={setProjectLocation}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              onPress={handleCreateProject}
              className="bg-construction-orange rounded-lg py-3"
            >
              <Text className="text-white text-center font-bold">Create Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Template Modal */}
      <Modal
        visible={showTemplateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <ScrollView className="bg-white rounded-t-2xl p-6" style={{ maxHeight: '85%' }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-construction-dark text-xl font-bold">
                New Template
              </Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <MaterialIcons name="close" size={24} color="#004E89" />
              </TouchableOpacity>
            </View>
            <Text className="text-construction-dark font-semibold mb-2">
              Template Name
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 bg-construction-light mb-4"
              placeholder="e.g., Pre-Pour Concrete"
              value={templateName}
              onChangeText={setTemplateName}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-construction-dark font-semibold mb-2">Division</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 bg-construction-light mb-4"
              placeholder="e.g., Concrete Pouring"
              value={templateDivision}
              onChangeText={setTemplateDivision}
              placeholderTextColor="#9CA3AF"
            />
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-construction-dark font-semibold">
                Checklist Items
              </Text>
              <TouchableOpacity
                onPress={() => setTemplateItems((prev) => [...prev, ''])}
              >
                <Text className="text-construction-orange font-bold">+ Add item</Text>
              </TouchableOpacity>
            </View>
            {templateItems.map((item, idx) => (
              <TextInput
                key={idx}
                className="border border-gray-300 rounded-lg px-4 py-3 bg-construction-light mb-2"
                placeholder={`Item ${idx + 1}`}
                value={item}
                onChangeText={(text) =>
                  setTemplateItems((prev) => {
                    const next = [...prev];
                    next[idx] = text;
                    return next;
                  })
                }
                placeholderTextColor="#9CA3AF"
              />
            ))}
            <TouchableOpacity
              onPress={handleCreateTemplate}
              className="bg-construction-orange rounded-lg py-3 mt-4 mb-6"
            >
              <Text className="text-white text-center font-bold">Create Template</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
