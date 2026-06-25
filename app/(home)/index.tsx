import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as db from '@/database/db';
import { runSync } from '@/services/sync';
import { useNotification } from '@/components/Notification';
import { useAuth } from '@/auth/authContext';
import { Card, ActionTile, PrimaryButton } from '@/components/ui';
import { shadowCard } from '@/components/ui/shadows';
import { Project, Template, ChecklistInstance } from '@/types/database';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, isManager, user, token } = useAuth();
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
      console.error('Project creation error:', error);
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
      const result = await runSync(token ?? undefined);
      if (!result.ok) {
        notify({ type: 'error', message: result.reason ?? 'Sync failed' });
      } else {
        notify({ type: 'success', message: 'Sync complete' });
        if (selectedProject) await selectProject(selectedProject);
        // Reflect any alerts pulled from other devices in the manager badge.
        if (isManager) setUnreadAlerts(await db.getUnacknowledgedAlertCount());
      }
    } catch (error) {
      notify({ type: 'error', message: 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-canvas">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <LinearGradient
        colors={['#004E89', '#0A6FB8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
          shadowCard,
        ]}
      >
        <View className="px-5 pt-4 pb-5">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center flex-1">
              <View className="w-11 h-11 rounded-2xl bg-white/15 items-center justify-center mr-3">
                <MaterialIcons name="engineering" size={24} color="#FF8A5C" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-xl font-bold tracking-tight">
                  Barnard
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <View className="bg-white/15 rounded-full px-2 py-0.5">
                    <Text className="text-white/90 text-[11px] font-semibold">
                      {isManager ? 'Management' : 'Inspector'}
                    </Text>
                  </View>
                  {user ? (
                    <Text className="text-white/70 text-xs ml-2">
                      {user.username}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Manager-only alerts bell */}
            {isManager && (
              <TouchableOpacity
                onPress={() => router.push('/(home)/alerts')}
                className="p-2 mr-0.5"
              >
                <MaterialIcons name="notifications" size={24} color="white" />
                {unreadAlerts > 0 && (
                  <View className="absolute right-0 top-0 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                    <Text className="text-white text-[10px] font-bold">
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => router.push('/(home)/activity-log')}
              className="p-2 mr-0.5"
            >
              <MaterialIcons name="history" size={22} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(home)/settings')}
              className="p-2 mr-0.5"
            >
              <MaterialIcons name="settings" size={22} color="white" />
            </TouchableOpacity>

            <TouchableOpacity onPress={logout} className="p-2">
              <AntDesign name="logout" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2.5">
            {isManager && (
              <TouchableOpacity
                onPress={() => setShowProjectModal(true)}
                activeOpacity={0.85}
                className="flex-1 bg-white rounded-xl py-3"
                style={shadowCard}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="add" size={20} color="#F2530F" />
                  <Text className="text-brand-700 font-bold ml-1">New Project</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncing}
              activeOpacity={0.85}
              className="bg-white/15 rounded-xl px-4 items-center justify-center"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="sync" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        {/* Management banner */}
        {isManager && unreadAlerts > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(home)/alerts')}
            activeOpacity={0.9}
            className="rounded-2xl p-4 mb-5 flex-row items-center"
            style={[{ backgroundColor: '#DC2626' }, shadowCard]}
          >
            <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
              <MaterialIcons name="warning" size={22} color="white" />
            </View>
            <Text className="text-white font-semibold ml-3 flex-1">
              {unreadAlerts} serious event{unreadAlerts > 1 ? 's' : ''} need attention
            </Text>
            <MaterialIcons name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
        )}

        {/* Safety Features Section */}
        <View className="mb-5">
          <Text className="text-ink font-bold text-lg mb-3 tracking-tight">Safety</Text>
          <View className="flex-row gap-3 mb-3">
            <ActionTile
              icon="emergency"
              label="Report Incident"
              color="#DC2626"
              disabled={!selectedProject}
              onPress={() =>
                router.push({
                  pathname: '/(safety)/report-incident',
                  params: { projectId: selectedProject?.id || '' },
                })
              }
            />
            <ActionTile
              icon="lightbulb"
              label="Safety Tips"
              color="#3B82F6"
              onPress={() => router.push('/(safety)/safety-tips')}
            />
            {isManager && (
              <ActionTile
                icon="assignment-late"
                label="View Incidents"
                color="#EA580C"
                disabled={!selectedProject}
                onPress={() =>
                  router.push({
                    pathname: '/(safety)/incidents-list',
                    params: { projectId: selectedProject?.id || '' },
                  })
                }
              />
            )}
          </View>
        </View>

        {/* Equipment Permits Section */}
        <View className="mb-5">
          <Text className="text-ink font-bold text-lg mb-3 tracking-tight">Equipment Permits</Text>
          <View className="flex-row gap-3">
            <ActionTile
              icon="local-fire-department"
              label="Hot Work Permit"
              color="#D97706"
              disabled={!selectedProject}
              onPress={() =>
                router.push({
                  pathname: '/(safety)/hot-work-permit',
                  params: { projectId: selectedProject?.id || '' },
                })
              }
            />
            <ActionTile
              icon="construction"
              label="Rigging Form"
              color="#7C3AED"
              disabled={!selectedProject}
              onPress={() =>
                router.push({
                  pathname: '/(safety)/rigging-form',
                  params: { projectId: selectedProject?.id || '' },
                })
              }
            />
          </View>
        </View>

        {/* Equipment Inspection Section */}
        <View className="mb-5">
          <Text className="text-ink font-bold text-lg mb-3 tracking-tight">Equipment Inspection</Text>
          <View className="flex-row gap-3">
            <ActionTile
              icon="checklist-rtl"
              label="Inspect Equipment"
              color="#0D9488"
              disabled={!selectedProject}
              onPress={() =>
                router.push({
                  pathname: '/(equipment)/inspect-equipment',
                  params: { projectId: selectedProject?.id || '' },
                })
              }
            />
            <ActionTile
              icon="list"
              label="View Inspections"
              color="#0891B2"
              disabled={!selectedProject}
              onPress={() =>
                router.push({
                  pathname: '/(equipment)/equipment-list',
                  params: { projectId: selectedProject?.id || '' },
                })
              }
            />
          </View>
        </View>

        {/* Search and Filter */}
        <View className="mb-5">
          <View className="flex-row items-center bg-surface rounded-xl px-4 mb-3" style={shadowCard}>
            <MaterialIcons name="search" size={20} color="#9AA7B8" />
            <TextInput
              placeholder="Search projects..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 px-3 py-3.5 text-ink text-base"
              placeholderTextColor="#9AA7B8"
            />
          </View>
          <View className="flex-row gap-2">
            {(['all', 'active', 'completed'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setFilterBy(filter)}
                activeOpacity={0.85}
                className={`flex-1 rounded-full py-2.5 px-3 ${
                  filterBy === filter ? 'bg-brand-700' : 'bg-surface border border-line'
                }`}
              >
                <Text
                  className={`text-center text-xs font-bold ${
                    filterBy === filter ? 'text-white' : 'text-muted'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Projects */}
        <Text className="text-ink text-lg font-bold mb-3 tracking-tight">
          Projects ({projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length})
        </Text>
        {projects.length === 0 ? (
          <Card className="p-7 items-center mb-6">
            <View className="w-14 h-14 rounded-2xl bg-canvas items-center justify-center mb-3">
              <MaterialIcons name="folder-open" size={30} color="#9AA7B8" />
            </View>
            <Text className="text-muted text-center">
              No projects yet. Create one to get started.
            </Text>
          </Card>
        ) : (
          <View className="mb-6">
            {projects
              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((project) => {
              const active = selectedProject?.id === project.id;
              return (
              <TouchableOpacity
                key={project.id}
                onPress={() => selectProject(project)}
                activeOpacity={0.85}
                className={`mb-2.5 p-4 rounded-2xl flex-row items-center ${
                  active ? 'bg-brand-700' : 'bg-surface'
                }`}
                style={shadowCard}
              >
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                    active ? 'bg-white/15' : 'bg-canvas'
                  }`}
                >
                  <MaterialIcons
                    name="business"
                    size={20}
                    color={active ? '#FFFFFF' : '#004E89'}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-bold text-base ${
                      active ? 'text-white' : 'text-ink'
                    }`}
                  >
                    {project.name}
                  </Text>
                  <Text
                    className={`text-sm ${active ? 'text-white/75' : 'text-muted'}`}
                  >
                    {project.location}
                  </Text>
                </View>
                {active && (
                  <MaterialIcons name="check-circle" size={22} color="#FF8A5C" />
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Templates */}
        {selectedProject && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-ink text-lg font-bold tracking-tight">
                Templates ({templates.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowTemplateModal(true)}
                activeOpacity={0.85}
                className="bg-accent-50 rounded-full px-3.5 py-1.5 flex-row items-center"
              >
                <MaterialIcons name="add" size={16} color="#F2530F" />
                <Text className="text-accent-600 font-bold text-xs ml-1">New</Text>
              </TouchableOpacity>
            </View>

            {templates.length === 0 ? (
              <Card className="p-7 items-center">
                <View className="w-14 h-14 rounded-2xl bg-canvas items-center justify-center mb-3">
                  <MaterialIcons name="description" size={30} color="#9AA7B8" />
                </View>
                <Text className="text-muted text-center">
                  No templates yet. Create one to start inspections.
                </Text>
              </Card>
            ) : (
              templates.map((tmpl) => (
                <Card key={tmpl.id} className="mb-3 p-4">
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 rounded-xl bg-brand-50 items-center justify-center mr-3">
                      <MaterialIcons name="description" size={20} color="#004E89" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-ink font-bold text-base">
                        {tmpl.name}
                      </Text>
                      <Text className="text-muted text-sm">{tmpl.division}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleStartInspection(tmpl.id)}
                    activeOpacity={0.85}
                    className="bg-accent-50 rounded-xl py-2.5 flex-row items-center justify-center"
                  >
                    <MaterialIcons name="play-arrow" size={18} color="#F2530F" />
                    <Text className="text-accent-600 text-center font-bold ml-1">
                      Start Inspection
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Active checklists */}
        {selectedProject && activeChecklists.length > 0 && (
          <View>
            <Text className="text-ink text-lg font-bold mb-3 tracking-tight">
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
              .map((checklist) => {
              const completed = checklist.status === 'COMPLETED';
              return (
              <TouchableOpacity
                key={checklist.id}
                onPress={() => handleOpenChecklist(checklist)}
                activeOpacity={0.85}
                className="mb-2.5 bg-surface rounded-2xl p-4 flex-row items-center"
                style={shadowCard}
              >
                <View
                  className="w-1 self-stretch rounded-full mr-3"
                  style={{ backgroundColor: completed ? '#16A34A' : '#FF6B35' }}
                />
                <View className="flex-1">
                  <Text className="text-ink font-semibold text-sm">
                    Created {new Date(checklist.created_at).toLocaleDateString()}
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    Inspector: {checklist.inspector_name}
                  </Text>
                </View>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: completed ? '#DCFCE7' : '#FFE0D1' }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: completed ? '#15803D' : '#C7400A' }}
                  >
                    {completed ? 'Completed' : 'Draft'}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-surface rounded-t-3xl p-6">
            <View className="items-center mb-3">
              <View className="w-10 h-1 rounded-full bg-line" />
            </View>
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-ink text-xl font-bold tracking-tight">
                New Project
              </Text>
              <TouchableOpacity
                onPress={() => setShowProjectModal(false)}
                className="w-8 h-8 rounded-full bg-canvas items-center justify-center"
              >
                <MaterialIcons name="close" size={20} color="#6B7A90" />
              </TouchableOpacity>
            </View>
            <Text className="text-ink font-semibold text-sm mb-2">
              Project Name
            </Text>
            <TextInput
              className="border border-line rounded-xl px-4 py-3.5 bg-canvas text-ink mb-4"
              placeholder="e.g., Downtown Office Tower"
              value={projectName}
              onChangeText={setProjectName}
              placeholderTextColor="#9AA7B8"
            />
            <Text className="text-ink font-semibold text-sm mb-2">Location</Text>
            <TextInput
              className="border border-line rounded-xl px-4 py-3.5 bg-canvas text-ink mb-5"
              placeholder="e.g., Block A - 123 Main St"
              value={projectLocation}
              onChangeText={setProjectLocation}
              placeholderTextColor="#9AA7B8"
            />
            <PrimaryButton
              label="Create Project"
              icon="add"
              onPress={handleCreateProject}
            />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Template Modal */}
      <Modal
        visible={showTemplateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <ScrollView className="bg-surface rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            <View className="items-center mb-3">
              <View className="w-10 h-1 rounded-full bg-line" />
            </View>
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-ink text-xl font-bold tracking-tight">
                New Template
              </Text>
              <TouchableOpacity
                onPress={() => setShowTemplateModal(false)}
                className="w-8 h-8 rounded-full bg-canvas items-center justify-center"
              >
                <MaterialIcons name="close" size={20} color="#6B7A90" />
              </TouchableOpacity>
            </View>
            <Text className="text-ink font-semibold text-sm mb-2">
              Template Name
            </Text>
            <TextInput
              className="border border-line rounded-xl px-4 py-3.5 bg-canvas text-ink mb-4"
              placeholder="e.g., Pre-Pour Concrete"
              value={templateName}
              onChangeText={setTemplateName}
              placeholderTextColor="#9AA7B8"
            />
            <Text className="text-ink font-semibold text-sm mb-2">Division</Text>
            <TextInput
              className="border border-line rounded-xl px-4 py-3.5 bg-canvas text-ink mb-4"
              placeholder="e.g., Concrete Pouring"
              value={templateDivision}
              onChangeText={setTemplateDivision}
              placeholderTextColor="#9AA7B8"
            />
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-ink font-semibold text-sm">
                Checklist Items
              </Text>
              <TouchableOpacity
                onPress={() => setTemplateItems((prev) => [...prev, ''])}
              >
                <Text className="text-accent-600 font-bold">+ Add item</Text>
              </TouchableOpacity>
            </View>
            {templateItems.map((item, idx) => (
              <TextInput
                key={idx}
                className="border border-line rounded-xl px-4 py-3.5 bg-canvas text-ink mb-2"
                placeholder={`Item ${idx + 1}`}
                value={item}
                onChangeText={(text) =>
                  setTemplateItems((prev) => {
                    const next = [...prev];
                    next[idx] = text;
                    return next;
                  })
                }
                placeholderTextColor="#9AA7B8"
              />
            ))}
            <View className="mt-4 mb-6">
              <PrimaryButton
                label="Create Template"
                icon="add"
                onPress={handleCreateTemplate}
              />
            </View>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
