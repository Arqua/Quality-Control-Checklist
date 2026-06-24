import { Stack } from 'expo-router';

export default function SafetyLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: '#004E89',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="safety-tips"
        options={{
          title: 'Safety Tips',
        }}
      />
      <Stack.Screen
        name="report-incident"
        options={{
          title: 'Report Incident',
        }}
      />
      <Stack.Screen
        name="incidents-list"
        options={{
          title: 'Incident Reports',
        }}
      />
      <Stack.Screen
        name="incident-details"
        options={{
          title: 'Incident Details',
        }}
      />
      <Stack.Screen
        name="hot-work-permit"
        options={{
          title: 'Hot Work Permit',
        }}
      />
      <Stack.Screen
        name="rigging-form"
        options={{
          title: 'Rigging Form',
        }}
      />
    </Stack>
  );
}
