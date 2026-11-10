import '@/lib/i18n';

import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useSegments,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ToastProvider } from '@/components/ui/toast';
import { Colors, Spacing } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';
import { installErrorReporting, pathFromSegments, reportError, trackScreen } from '@/lib/telemetry';

// Splash drží, dokud se nenačte uložené přihlášení (jinak by problikl úvod).
SplashScreen.preventAutoHideAsync();
installErrorReporting();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Colors.primary, background: Colors.background },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <ToastProvider>
          <RootStack />
        </ToastProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

// Pád při vykreslení kdekoli v appce: nahlásit a nabídnout nový pokus místo bílé obrazovky.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  useEffect(() => {
    reportError(error);
    SplashScreen.hideAsync();
  }, [error]);

  return (
    <View style={styles.crash}>
      <EmptyState
        icon={{ ios: 'exclamationmark.triangle', android: 'error' }}
        tone="danger"
        title={t('app.errors.crashTitle')}
        text={t('app.errors.crashText')}
        action={{ label: t('app.common.tryAgain'), onPress: retry }}
      />
    </View>
  );
}

function RootStack() {
  const { status, user } = useSession();
  const segments = useSegments();
  const screenPath = pathFromSegments(segments);

  useEffect(() => {
    if (status === 'ready') SplashScreen.hideAsync();
  }, [status]);

  useEffect(() => {
    if (status === 'ready') trackScreen(screenPath);
  }, [status, screenPath]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(uvod)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      {/* Přihlášení je dostupné i hostovi (uložení výletu do účtu). */}
      <Stack.Screen
        name="prihlaseni"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          // Bez toho je pod obsahem vidět průhledné pozadí iOS sheetu.
          contentStyle: { backgroundColor: Colors.surface },
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.five,
    backgroundColor: Colors.background,
  },
});
