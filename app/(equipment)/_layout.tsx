import { Stack } from 'expo-router';

export default function EquipmentLayout() {
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
        name="inspect-equipment"
        options={{
          title: 'Inspect Equipment',
        }}
      />
      <Stack.Screen
        name="equipment-list"
        options={{
          title: 'Equipment Inspections',
        }}
      />
    </Stack>
  );
}
