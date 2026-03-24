import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/src/theme';

export default function TabLayout() {
  const { dark, colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: dark ? colors.surface : colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: dark ? colors.surface : colors.bg,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'terminal' : 'terminal-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: 'Files',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'folder' : 'folder-outline'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons color={color} name={focused ? 'settings' : 'settings-outline'} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
