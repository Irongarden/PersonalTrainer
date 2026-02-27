import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/hooks/useTheme';
import { useWorkoutStore } from '../../src/stores/workoutStore';

const TAB_ICONS: Record<string, string> = {
  workouts: '🏋️',
  library: '📚',
  history: '📊',
  meals: '🥗',
  coach: '🤖',
};

const TAB_LABELS: Record<string, string> = {
  workouts: 'Train',
  library: 'Library',
  history: 'History',
  meals: 'Meals',
  coach: 'Coach',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 19, opacity: focused ? 1 : 0.45 }}>
      {TAB_ICONS[name] ?? '●'}
    </Text>
  );
}

export default function TabsLayout() {
  const session = useAuthStore(s => s.session);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const theme = useTheme();

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 6,
          paddingTop: 4,
          paddingHorizontal: 16,
        },
        tabBarItemStyle: {
          maxWidth: 80,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: -2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="workouts"
        options={{
          title: TAB_LABELS.workouts,
          tabBarIcon: ({ focused }) => <TabIcon name="workouts" focused={focused} />,
          tabBarBadge: activeSession ? '●' : undefined,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: TAB_LABELS.library,
          tabBarIcon: ({ focused }) => <TabIcon name="library" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: TAB_LABELS.history,
          tabBarIcon: ({ focused }) => <TabIcon name="history" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: TAB_LABELS.meals,
          tabBarIcon: ({ focused }) => <TabIcon name="meals" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: TAB_LABELS.coach,
          tabBarIcon: ({ focused }) => <TabIcon name="coach" focused={focused} />,
        }}
      />
      {/* Settings: hidden from tab bar, accessible via ⚙️ in workouts header */}
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          href: null,
        }}
      />
    </Tabs>
  );
}
