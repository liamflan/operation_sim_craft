import { Tabs, Slot, useRouter, usePathname } from 'expo-router';
import React from 'react';
import { useWindowDimensions, View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome5 } from '@expo/vector-icons';
import { PantryProvider } from '../../data/PantryContext';
import { WeeklyRoutineProvider } from '../../data/WeeklyRoutineContext';
import { useActivePlan } from '../../data/ActivePlanContext';
import { TOKENS } from '../../theme/tokens';

function NavItem({ icon, label, isActive, onPress }: { icon: string, label: string, isActive: boolean, onPress: () => void }) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.navItem,
        isActive ? styles.navItemActive : styles.navItemInactive
      ]}
    >
      <View style={{ width: 24, alignItems: 'center', marginRight: 14 }}>
        <FontAwesome5 
          name={icon} 
          size={13.5} 
          color={isActive ? '#7BA96A' : '#8C9A90'} 
          style={{ opacity: isActive ? 1 : 0.55 }}
        />
      </View>
      <Text style={[
        styles.navLabel,
        { color: isActive ? TOKENS.colors.text.light.emphasis : 'rgba(140, 161, 143, 0.6)' },
        { fontWeight: isActive ? '500' : '400' }
      ]}>{label}</Text>
      
      {isActive && (
        <View style={styles.navActiveDot} />
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
        style={[
          { flex: 1, flexDirection: 'row', backgroundColor: TOKENS.colors.background.light },
          Platform.OS === 'web' ? { height: '100vh', width: '100vw', overflow: 'hidden' } as any : undefined
        ]}
      >
        {/* Persistent Left Sidebar - Softened Editorial Shell */}
        <View 
          style={[
            styles.sidebar,
            Platform.OS === 'web' ? { flexShrink: 0, height: '100%' } : { height: '100%' }
          ]}
        >
          {/* Brand Area - Simplified Editorial Branding */}
          <View style={{ paddingHorizontal: 32, marginBottom: 48 }}>
            <Text style={styles.brandTitle}>Provision</Text>
            <Text style={styles.brandTagline}>Taste-Led Planning</Text>
          </View>

          {/* Navigation Items */}
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <View style={{ marginBottom: 8 }}>
              <NavItem 
                icon="home" 
                label="Dashboard" 
                isActive={pathname === '/' || pathname === '/(tabs)'} 
                onPress={() => router.push('/(tabs)')} 
              />
              <NavItem 
                icon="shopping-basket" 
                label="Shopping List" 
                isActive={pathname === '/shopping-list' || pathname === '/(tabs)/shopping-list'} 
                onPress={() => router.push('/(tabs)/shopping-list')} 
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
                label="Recipes" 
                isActive={pathname === '/library' || pathname === '/(tabs)/library'} 
                onPress={() => router.push('/(tabs)/library')} 
              />
            </View>

            <View style={styles.sidebarSeparator}>
              <Text style={styles.sidebarSectionLabel}>Lab Tools</Text>
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
          <View style={styles.sidebarFooter}>
            <TouchableOpacity 
              onPress={handleReset}
              activeOpacity={0.7}
              style={styles.resetButton}
            >
              <View style={{ width: 20, alignItems: 'center', marginRight: 12 }}>
                <FontAwesome5 name="undo-alt" size={10} color="#EF4444" style={{ opacity: 0.4 }} />
              </View>
              <Text style={styles.resetButtonText}>Reset Workspace</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}
              style={[
                styles.profileCard,
                pathname.includes('settings') ? styles.profileCardActive : styles.profileCardInactive
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>LF</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>Liam F.</Text>
                <Text style={styles.profilePlan}>Free Account</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fluid Main Content Area */}
        <View style={[{ flex: 1 }, Platform.OS === 'web' ? { height: '100%', overflow: 'hidden' } : undefined]}>
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
        name="shopping-list"
        options={{
          title: 'Shopping List',
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

const styles = StyleSheet.create({
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 2
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(157, 205, 139, 0.1)',
    shadowColor: 'rgba(157, 205, 139, 0.04)',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 6,
    elevation: 1
  },
  navItemInactive: {
    borderWidth: 1,
    borderColor: 'transparent'
  },
  navLabel: {
    fontSize: 14,
    letterSpacing: -0.2
  },
  navActiveDot: {
    marginLeft: 'auto',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(157, 205, 139, 0.25)'
  },
  sidebar: {
    width: 265,
    backgroundColor: 'rgba(238, 244, 232, 0.4)',
    paddingTop: 48,
    paddingBottom: 24,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.03)',
    zIndex: 10
  },
  brandTitle: {
    color: TOKENS.colors.text.light.emphasis,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -1.5,
    marginBottom: 4
  },
  brandTagline: {
    color: TOKENS.colors.primary,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2.5
  },
  sidebarSeparator: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.03)'
  },
  sidebarSectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 16,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(140, 161, 143, 0.3)'
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.03)',
    backgroundColor: 'rgba(0, 0, 0, 0.01)'
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20
  },
  resetButtonText: {
    color: 'rgba(239, 68, 68, 0.5)',
    fontWeight: '800',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20
  },
  profileCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  profileCardInactive: {
    backgroundColor: 'transparent'
  },
  avatar: {
    width: 36,
    height: 36,
    backgroundColor: 'white',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)'
  },
  avatarText: {
    color: 'rgba(140, 161, 143, 0.6)',
    fontWeight: '500',
    fontSize: 13
  },
  profileName: {
    color: TOKENS.colors.text.light.emphasis,
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: -0.2
  },
  profilePlan: {
    color: 'rgba(140, 161, 143, 0.4)',
    fontSize: 11,
    marginTop: 2
  }
});
