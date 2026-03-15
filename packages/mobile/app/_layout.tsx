import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useServersStore } from '@/src/stores/servers';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.tint,
  },
};

export default function RootLayout() {
  const load = useServersStore((state) => state.load);
  const loaded = useServersStore((state) => state.loaded);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.dark.tint} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar backgroundColor={Colors.dark.background} style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Colors.dark.background },
          headerStyle: { backgroundColor: Colors.dark.card },
          headerTintColor: Colors.dark.text,
          headerTitleStyle: { color: Colors.dark.text, fontWeight: '600' },
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
  },
});
