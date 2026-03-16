import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useServersStore } from '@/src/stores/servers';
import { useSettingsStore } from '@/src/stores/settings';
import { ToastConfig } from '@/src/components/ui';
import { AppThemeProvider, useTheme } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function AppContent() {
  const { dark, colors, navigationTheme } = useTheme();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar backgroundColor={colors.bg} style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: dark ? colors.surface : colors.bg },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="terminal/[sessionId]"
          options={{
            headerShown: true,
            title: 'Terminal',
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const loadServers = useServersStore((state) => state.load);
  const serversLoaded = useServersStore((state) => state.loaded);
  const loadSettings = useSettingsStore((state) => state.load);
  const settingsLoaded = useSettingsStore((state) => state.loaded);
  const loaded = serversLoaded && settingsLoaded;

  useEffect(() => {
    void Promise.all([loadServers(), loadSettings()]);
  }, [loadServers, loadSettings]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator color="#D4713D" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <AppThemeProvider>
        <AppContent />
        <ToastConfig />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1915',
  },
});
