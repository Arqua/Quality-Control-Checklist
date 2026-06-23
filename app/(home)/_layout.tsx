import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="new-checklist"
        options={{
          title: 'New Checklist',
          headerTintColor: '#004E89',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      />
      <Stack.Screen
        name="alerts"
        options={{
          title: 'Management Alerts',
          headerShown: true,
          headerTintColor: '#004E89',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      />
      <Stack.Screen
        name="activity-log"
        options={{
          title: 'Team Activity',
          headerShown: true,
          headerTintColor: '#004E89',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: true,
          headerTintColor: '#004E89',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      />
    </Stack>
  );
}
