import { Stack } from 'expo-router';

export default function InspectionLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitleVisible: false,
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
    </Stack>
  );
}
