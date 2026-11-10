import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function IntroLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="kam"
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: Colors.text,
        }}
      />
    </Stack>
  );
}
