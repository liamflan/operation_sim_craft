import { Tabs, Slot, useRouter, usePathname } from 'expo-router';
import React from 'react';
import { useWindowDimensions, View, Text, TouchableOpacity, Platform } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome5 } from '@expo/vector-icons';
import { PantryProvider } from '../../data/PantryContext';
import { WeeklyRoutineProvider } from '../../data/WeeklyRoutineContext';

function NavItem({ icon, label, isActive, onPress }: { icon: string, label: string, isActive: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-2xl mb-2 transition-colors ${isActive ? 'bg-avocado/10' : 'hover:bg-charcoal/5 dark:hover:bg-white/5'}`}
    >
      <View className="w-8">
        <FontAwesome5 name={icon} size={20} color={isActive ? '#6DBE75' : '#71717a'} />
      </View>
      <Text className={`text-lg font-bold ${isActive ? 'text-avocado' : 'text-gray-600 dark:text-gray-400'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Tailwind md breakpoint
  const router = useRouter();
  const pathname = usePathname();

  if (isDesktop) {
    return (
      <WeeklyRoutineProvider>
      <PantryProvider>
        <View className="flex-1 flex-row bg-cream dark:bg-darkcream">
        {/* Persistent Left Sidebar */}
        <View className="w-64 bg-white dark:bg-darkgrey border-r border-black/5 dark:border-white/5 pt-12 px-6 pb-8 h-full sticky top-0 print-hide" style={{position: Platform.OS === 'web' ? 'fixed' : 'relative', height: '100%'}}>
          <View className="mb-12">
            <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight">Provision</Text>
            <Text className="text-avocado text-sm font-bold uppercase tracking-widest mt-1">Taste-Led Planning</Text>
          </View>

          <View className="flex-1">
            <NavItem 
              icon="home" 
              label="Dashboard" 
              isActive={pathname === '/'} 
              onPress={() => router.push('/(tabs)')} 
            />
            <NavItem 
              icon="list" 
              label="Fuel List" 
              isActive={pathname === '/shop'} 
              onPress={() => router.push('/(tabs)/shop')} 
            />
            <NavItem 
              icon="star" 
              label="Taste Profile" 
              isActive={pathname === '/taste-profile'} 
              onPress={() => router.push('/(tabs)/taste-profile')} 
            />
            <NavItem 
              icon="box-open" 
              label="Pantry" 
              isActive={pathname === '/pantry'} 
              onPress={() => router.push('/(tabs)/pantry')} 
            />
            <NavItem 
              icon="flask" 
              label="Planner Dev" 
              isActive={pathname === '/planner-dev'} 
              onPress={() => router.push('/(tabs)/planner-dev')} 
            />
          </View>
          
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/settings')}
            className="flex-row items-center p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors mt-auto"
          >
            <View className="w-10 h-10 bg-avocado rounded-full items-center justify-center mr-3 shadow-sm border border-black/5 dark:border-white/10">
              <Text className="text-white font-bold text-sm leading-none">LF</Text>
            </View>
            <View>
              <Text className="text-charcoal dark:text-darkcharcoal font-bold leading-tight">Liam F.</Text>
              <Text className="text-gray-500 text-xs">Settings</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Fluid Main Content Area */}
        <View className="flex-1 print-expand" style={{marginLeft: Platform.OS === 'web' ? 256 : 0}}> {/* 256px is w-64 */}
          <Slot />
        </View>
      </View>
      </PantryProvider>
      </WeeklyRoutineProvider>
    );
  }

  // Mobile Fallback: Standard Bottom Tabs
  return (
    <WeeklyRoutineProvider>
    <PantryProvider>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6DBE75',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: 'rgba(0,0,0,0.05)',
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'List',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="taste-profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Pantry',
          tabBarIcon: ({ color }) => <FontAwesome5 size={24} name="box-open" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: null,
        }}
      />
      <Tabs.Screen
        name="planner-dev"
        options={{
          title: 'Planner Dev',
          href: null,
        }}
      />
    </Tabs>
    </PantryProvider>
    </WeeklyRoutineProvider>
  );
}
