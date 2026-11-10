import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';

// iOS 26 má vlastní efekt pod hlavičkou při scrollu, rozmazání stačí jen starším verzím.
const legacyBlur = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) < 26;

// Společný stack pro každý tab: velký iOS nadpis, který se při scrollu zmenší.
export function TabStack({ title }: { title: string }) {
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerTransparent: true,
        headerBlurEffect: legacyBlur ? 'systemChromeMaterial' : undefined,
        headerTintColor: Colors.primary,
        headerLargeStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text },
        headerLargeTitleStyle: { color: Colors.text },
      }}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
