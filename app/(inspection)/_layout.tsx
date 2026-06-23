import { Stack } from 'expo-router';

export default function InspectionLayout() {
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
        name="index"
        options={{
          title: 'Inspection Checklist',
        }}
      />
      <Stack.Screen
        name="punch-list"
        options={{
          title: 'Punch List',
        }}
      />
    </Stack>
  );
}
