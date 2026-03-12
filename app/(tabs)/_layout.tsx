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
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-2.5 rounded-2xl mb-0.5 transition-all duration-300 ${
        isActive 
          ? 'bg-white/50 dark:bg-white/10 border border-primary/10 dark:border-primary/20 shadow-[0_1px_6px_rgba(157,205,139,0.04)]' 
          : 'hover:bg-white/30 dark:hover:bg-white/5 border border-transparent'
      }`}
    >
      <View className="w-6 items-center mr-3.5">
        <FontAwesome5 
          name={icon} 
          size={13.5} 
          color={isActive ? '#7BA96A' : '#8C9A90'} 
          style={{ opacity: isActive ? 1 : 0.55 }}
        />
      </View>
      <Text className={`text-[14px] tracking-tight ${
        isActive 
          ? 'text-textMain dark:text-darktextMain font-medium' 
          : 'text-textSec/70 dark:text-darktextSec/60 font-normal'
      }`}>{label}</Text>
      
      {isActive && (
        <View className="ml-auto w-1 h-1 rounded-full bg-primary/25 dark:bg-primary/40" />
      )}
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
    const message = 'Are you sure you want to reset your entire plan and account baseline? This cannot be undone.';
    
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        clearWorkspace();
        router.replace('/calibration');
      }
    } else {
      import('react-native').then(({ Alert }) => {
        Alert.alert(
          'Reset System',
          message,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reset', 
              style: 'destructive',
              onPress: () => {
                clearWorkspace();
                router.replace('/calibration');
              }
            }
          ]
        );
      });
    }
  };

  if (isDesktop) {
    return (
      <View 
        className="flex-1 flex-row bg-appBg dark:bg-darkappBg"
        style={Platform.OS === 'web' ? { height: '100vh', width: '100vw', overflow: 'hidden' } as any : undefined}
      >
        {/* Persistent Left Sidebar - Softened Editorial Shell */}
        <View 
          className="w-[265px] bg-[#EEF4E8]/40 dark:bg-[#1A221E] pt-12 pb-6 print-hide border-r border-black/[0.03] dark:border-white/[0.04] z-10" 
          style={Platform.OS === 'web' ? { flexShrink: 0, height: '100%' } : { height: '100%' }}
        >
          {/* Brand Area - Simplified Editorial Branding */}
          <View className="px-8 mb-12">
            <Text className="text-textMain dark:text-darktextMain text-[24px] font-semibold tracking-tighter mb-1">Provision</Text>
            <Text className="text-primary dark:text-[#85B674] text-[9.5px] font-bold uppercase tracking-[0.25em]">Taste-Led Planning</Text>
          </View>

          {/* Navigation Items */}
          <View className="flex-1 px-4">
            <View className="mb-2">
              <NavItem 
                icon="home" 
                label="Dashboard" 
                isActive={pathname === '/' || pathname === '/(tabs)'} 
                onPress={() => router.push('/(tabs)')} 
              />
              <NavItem 
                icon="shopping-basket" 
                label="Fuel List" 
                isActive={pathname === '/shop' || pathname === '/(tabs)/shop'} 
                onPress={() => router.push('/(tabs)/shop')} 
              />
              <NavItem 
                icon="star" 
                label="Taste Profile" 
                isActive={pathname === '/taste-profile' || pathname === '/(tabs)/taste-profile'} 
                onPress={() => router.push('/(tabs)/taste-profile')} 
              />
              <NavItem 
                icon="box-open" 
                label="Pantry" 
                isActive={pathname === '/pantry' || pathname === '/(tabs)/pantry'} 
                onPress={() => router.push('/(tabs)/pantry')} 
              />
              <NavItem 
                icon="book-open" 
                label="Library" 
                isActive={pathname === '/library' || pathname === '/(tabs)/library'} 
                onPress={() => router.push('/(tabs)/library')} 
              />
            </View>

            <View className="mt-8 pt-6 border-t border-black/[0.03] dark:border-white/[0.03]">
              <Text className="px-5 mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-textSec/30 dark:text-darktextSec/30">Lab Tools</Text>
              <NavItem 
                icon="vial" 
                label="Planner Dev" 
                isActive={pathname === '/planner-dev' || pathname === '/(tabs)/planner-dev'} 
                onPress={() => router.push('/(tabs)/planner-dev')} 
              />
              <NavItem 
                icon="flask" 
                label="Sandbox" 
                isActive={pathname === '/planner-sandbox' || pathname === '/(tabs)/planner-sandbox'} 
                onPress={() => router.push('/(tabs)/planner-sandbox')} 
              />
            </View>
          </View>

          {/* Anchored Footer Area - Softer Profile Identity */}
          <View className="mt-auto px-4 pt-4 border-t border-black/[0.03] dark:border-white/5 bg-black/[0.01] dark:bg-black/5">
            <TouchableOpacity 
              onPress={handleReset}
              activeOpacity={0.7}
              className="flex-row items-center px-5 py-2 rounded-xl hover:bg-red-500/[0.04] transition-colors mb-5 group"
            >
              <View className="w-5 items-center mr-3">
                <FontAwesome5 name="undo-alt" size={10} color="#EF4444" style={{ opacity: 0.4 }} className="group-hover:opacity-80" />
              </View>
              <Text className="text-red-500/50 group-hover:text-red-500/80 font-bold text-[9px] uppercase tracking-widest leading-none mt-0.5">Reset Workspace</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
              className={`flex-row items-center p-3.5 rounded-2xl transition-all ${
                pathname.includes('settings') 
                  ? 'bg-white/60 dark:bg-white/10 shadow-sm border border-black/[0.02] dark:border-white/5' 
                  : 'bg-transparent hover:bg-white/40 dark:hover:bg-white/5'
              }`}
            >
              <View className="w-9 h-9 bg-white dark:bg-darksurface rounded-full items-center justify-center mr-3.5 shadow-sm border border-black/[0.02] dark:border-white/5">
                <Text className="text-textSec dark:text-darktextSec font-medium text-[13px]">LF</Text>
              </View>
              <View className="flex-1">
                <Text className="text-textMain dark:text-darktextMain font-medium text-[14px] tracking-tight">Liam F.</Text>
                <Text className="text-textSec/50 dark:text-darktextSec/40 text-[11px] font-normal mt-0.5">Free Account</Text>
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
