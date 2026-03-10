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
import { useActivePlan } from '../../data/ActivePlanContext';

function NavItem({ icon, label, isActive, onPress }: { icon: string, label: string, isActive: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className={`flex-row items-center px-3.5 py-2.5 rounded-full mb-1.5 transition-all duration-300 ${
        isActive 
          ? 'bg-primary/15 dark:bg-primary/20 border border-primary/10 dark:border-primary/10' 
          : 'hover:bg-white/40 dark:hover:bg-white/5 border border-transparent'
      }`}
    >
      <View className="w-8 items-center mr-2">
        <FontAwesome5 name={icon} size={14} color={isActive ? '#7BA96A' : '#A3B3A9'} />
      </View>
      <Text className={`font-normal text-[14px] tracking-wide ${
        isActive ? 'text-[#24332D] font-medium dark:text-darktextMain' : 'text-[#6E7C74] dark:text-darktextSec'
      }`}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Tailwind md breakpoint
  const router = useRouter();
  const pathname = usePathname();
  const { clearWorkspace } = useActivePlan();

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your entire plan and account baseline? This cannot be undone.')) {
      clearWorkspace();
      router.replace('/calibration');
    }
  };

  if (isDesktop) {
    return (
      <View 
        className="flex-1 flex-row bg-appBg dark:bg-darkappBg"
        style={Platform.OS === 'web' ? { height: '100vh', width: '100vw', overflow: 'hidden' } as any : undefined}
      >
        {/* Persistent Left Sidebar */}
        <View 
          className="w-[260px] bg-[#EEF4E8] dark:bg-darksageTint pt-12 px-5 pb-8 print-hide border-r border-transparent dark:border-darksoftBorder shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10" 
          style={Platform.OS === 'web' ? { flexShrink: 0, height: '100%' } : { height: '100%' }}
        >
          <View className="mb-12 pl-3">
            <Text className="text-textMain dark:text-darktextMain text-[24px] font-semibold tracking-tight">Provision</Text>
            <Text className="text-primary text-[10px] font-medium uppercase tracking-widest mt-1 opacity-80">Taste-Led Setup</Text>
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
            <NavItem 
              icon="vial" 
              label="Planner Sandbox" 
              isActive={pathname === '/planner-sandbox'} 
              onPress={() => router.push('/(tabs)/planner-sandbox')} 
            />
          </View>
          <View className="mt-auto">
            <TouchableOpacity 
              onPress={handleReset}
              className="flex-row items-center p-3 rounded-full hover:bg-red-500/10 dark:hover:bg-red-500/10 transition-colors mb-2 group border border-transparent hover:border-red-500/20"
            >
              <View className="w-8 items-center mr-2">
                <FontAwesome5 name="trash-alt" size={12} color="#EF4444" className="opacity-60 group-hover:opacity-100" />
              </View>
              <Text className="text-red-500/60 group-hover:text-red-500 font-bold text-[11px] uppercase tracking-widest">Reset System</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/settings')}
              className="flex-row items-center p-3 rounded-full hover:bg-white/40 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-white/40"
            >
              <View className="w-10 h-10 bg-white/80 dark:bg-darksurface rounded-full items-center justify-center mr-3 shadow-sm">
                <Text className="text-[#6E7C74] dark:text-darktextSec font-medium text-caption leading-none tracking-tight">LF</Text>
              </View>
              <View>
                <Text className="text-textMain dark:text-darktextMain font-medium text-[14px] leading-tight">Liam F.</Text>
                <Text className="text-textSec dark:text-darktextSec text-[11px] font-medium mt-0.5 opacity-80">Free Plan</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fluid Main Content Area */}
        <View className="flex-1 print-expand" style={Platform.OS === 'web' ? { height: '100%', overflow: 'hidden' } : undefined}>
          <Slot />
        </View>
      </View>
    );
  }

  // Mobile Fallback: Standard Bottom Tabs
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#9DCD8B',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FBFCF8',
          borderTopColor: '#DDE6D8',
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
      <Tabs.Screen
        name="planner-sandbox"
        options={{
          title: 'Planner Sandbox',
          href: null,
        }}
      />
    </Tabs>
  );
}
