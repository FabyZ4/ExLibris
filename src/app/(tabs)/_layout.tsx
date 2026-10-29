import { ExLibrisColors } from '@/constants/theme';
import { useExLibris } from '@/store/ExLibrisContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { currentUser } = useExLibris();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabBarHeight = 58 + insets.bottom;

  // Redirect to login when session ends
  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
    }
  }, [currentUser, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ExLibrisColors.primary,
        tabBarInactiveTintColor: ExLibrisColors.textSecondary,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: insets.bottom + 4 }],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={22} color={typeof color === 'string' ? color : undefined} />
          ),
        }}
      />

      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={22} color={typeof color === 'string' ? color : undefined} />
          ),
        }}
      />

      <Tabs.Screen
        name="escaner"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'barcode' : 'barcode-outline'} size={22} color={typeof color === 'string' ? color : undefined} />
          ),
        }}
      />

      <Tabs.Screen
        name="comunidad"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={typeof color === 'string' ? color : undefined} />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={typeof color === 'string' ? color : undefined} />
          ),
        }}
      />

      {/* Moderation hidden from tabs — accessible from profile screen */}
      <Tabs.Screen
        name="moderacion"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: ExLibrisColors.surface,
    borderTopColor: ExLibrisColors.border,
    borderTopWidth: 1,
    height: 58,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
});
