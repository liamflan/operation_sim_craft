import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput, 
  Platform,
  Dimensions,
  Image as RNImage
} from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import PageHeader from '../../components/PageHeader';
import { MOCK_RECIPES } from '../../data/seed';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to normalize image sources for native stability
const getSafeSource = (imageUrl: any) => {
  if (!imageUrl) return null;
  if (typeof imageUrl === 'string') {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http')) return { uri: trimmed };
    if (Platform.OS === 'web') return { uri: trimmed }; // Handle local paths on web
  }
  if (typeof imageUrl === 'number') return imageUrl; // asset from require()
  return null;
};

// Sub-components
const FilterChip = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    className={`px-5 py-2.5 rounded-full border ${
      active 
        ? 'bg-primary/10 border-primary/20 shadow-sm' 
        : 'bg-surface dark:bg-darksurface border-black/[0.04] dark:border-darksoftBorder hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
    }`}
  >
    <Text className={`text-[13px] font-bold ${active ? 'text-primary' : 'text-textSec dark:text-darktextSec'}`}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function LibraryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'saved' | 'recent' | 'collections'>('saved');
  const [activeFilter, setActiveFilter] = useState('All');

  const filters = ['All', 'High Protein', 'Breakfast', 'Vegan', 'Dinner', 'Under 30m'];

  const filteredRecipes = useMemo(() => {
    return MOCK_RECIPES.filter(recipe => {
      const matchesSearch = recipe.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = activeFilter === 'All' || 
                           (activeFilter === 'High Protein' && (recipe.macrosPerServing?.protein ?? 0) > 30) ||
                           (activeFilter === 'Vegan' && recipe.dietaryBaseline === 'Vegan') ||
                           (activeFilter === 'Under 30m' && recipe.totalMinutes < 30);
      return matchesSearch && matchesFilter;
    });
  }, [search, activeFilter]);

  return (
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-7xl px-4 md:px-12 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header Section */}
          <PageHeader 
            eyebrow="YOUR CULINARY ARCHIVE"
            title="Library"
            subtitle="Your saved recipes and collections."
          />

          {/* Search and Filter Area */}
          <View className="mb-12">
            <View className="flex-row items-center bg-surface dark:bg-darksurface rounded-[28px] px-6 h-16 border border-black/[0.04] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-8">
              <FontAwesome5 name="search" size={12} color="#8C9A90" className="mr-5" />
              <TextInput 
                placeholder="Search your library..."
                value={search}
                onChangeText={setSearch}
                className="flex-1 text-textMain dark:text-darktextMain text-[16px] font-medium outline-none"
                style={{ outlineWidth: 0 } as any}
                placeholderTextColor="#A0A8A2"
              />
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="-mx-4 md:mx-0 px-4 md:px-0"
              contentContainerStyle={{ gap: 10 }}
            >
              {filters.map(filter => (
                <FilterChip 
                  key={filter} 
                  label={filter} 
                  active={activeFilter === filter} 
                  onPress={() => setActiveFilter(filter)} 
                />
              ))}
            </ScrollView>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row items-center border-b border-black/[0.04] dark:border-white/5 mb-10">
            {(['saved', 'recent', 'collections'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
                className="mr-10 pb-3 relative"
              >
                <Text className={`text-[13px] font-bold uppercase tracking-[0.2em] ${activeTab === tab ? 'text-textMain dark:text-darktextMain' : 'text-textSec/40 dark:text-darktextSec/40'}`}>
                  {tab}
                </Text>
                {activeTab === tab && (
                  <View className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Recipe Grid */}
          <View className="flex-row flex-wrap -mx-3">
            {filteredRecipes.length === 0 ? (
              <View className="w-full py-20 items-center justify-center">
                <FontAwesome5 name="book-open" size={32} color="#CBD5E3" className="mb-6 opacity-40" />
                <Text className="text-textSec/60 dark:text-darktextSec/40 font-medium text-[16px]">No recipes found matching your search.</Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => {
                const safeSource = getSafeSource(recipe.imageUrl);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                    activeOpacity={0.8}
                    className="w-full sm:w-1/2 lg:w-1/3 px-3 mb-8"
                  >
                    <View className="bg-surface dark:bg-darksurface rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] h-[280px] relative group">
                      
                      {/* Image Area with Hardened Source Handling */}
                      <View className="h-[180px] bg-black/[0.05] dark:bg-white/[0.05] relative overflow-hidden">
                        {Platform.OS !== 'web' ? (
                          safeSource ? (
                            <RNImage 
                              source={safeSource} 
                              style={{ width: '100%', height: '100%' }} 
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F0' }}>
                              <FontAwesome5 name="utensils" size={24} color="#CBD5E1" />
                            </View>
                          )
                        ) : (
                          safeSource && (
                            <Image 
                              source={safeSource} 
                              style={{ width: '100%', height: '100%' }} 
                              contentFit="cover"
                            />
                          )
                        )}
                        
                        <LinearGradient 
                          colors={['transparent', 'rgba(0,0,0,0.4)']} 
                          className="absolute inset-0 z-10" 
                        />
                        <View className="absolute top-4 right-4 z-20">
                          <TouchableOpacity 
                            activeOpacity={0.7}
                            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md items-center justify-center border border-white/30"
                          >
                            <FontAwesome5 name="bookmark" size={12} color="white" solid />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Info Area */}
                      <View className="p-5 flex-1">
                        <View className="flex-row items-center mb-1.5 opacity-60">
                          <Text className="text-[10px] font-bold uppercase tracking-widest text-textMain dark:text-darktextMain">
                            {recipe.dietaryBaseline}
                          </Text>
                          <View className="w-1 h-1 bg-black/10 dark:bg-white/10 rounded-full mx-2" />
                          <Text className="text-[10px] font-bold uppercase tracking-widest text-textMain dark:text-darktextMain">
                            {recipe.totalMinutes}m
                          </Text>
                        </View>
                        <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight leading-tight group-hover:text-primary" numberOfLines={2}>
                          {recipe.title}
                        </Text>
                      </View>

                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Collections Section */}
          <View className="mt-16">
            <View className="flex-row justify-between items-baseline mb-8 px-1">
              <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">Your Collections</Text>
              <TouchableOpacity activeOpacity={0.7}>
                 <Text className="text-primary font-bold text-[13px] tracking-wide">Create New</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row -mx-3">
              {[
                { title: 'Summer Staples', count: 12, icon: 'sun', color: 'bg-peach' },
                { title: 'Quick & Healthy', count: 8, icon: 'bolt', color: 'bg-avocado' },
                { title: 'Meal Prep Sunday', count: 15, icon: 'calendar', color: 'bg-blueberry' }
              ].map((collection, idx) => (
                <TouchableOpacity key={idx} activeOpacity={0.7} className="w-1/3 px-3">
                  <View className="bg-surface dark:bg-darksurface rounded-[28px] p-6 items-center shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-black/[0.03] dark:border-darksoftBorder hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <View className={`w-12 h-12 rounded-2xl ${collection.color} items-center justify-center mb-4 shadow-sm`}>
                      <FontAwesome5 name={collection.icon} size={16} color="white" />
                    </View>
                    <Text className="text-textMain dark:text-darktextMain text-[14px] font-bold text-center tracking-tight" numberOfLines={1}>{collection.title}</Text>
                    <Text className="text-textSec/50 dark:text-darktextSec/40 text-[10px] uppercase font-bold tracking-[0.15em] mt-1">{collection.count} Items</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Action FAB for native */}
      <View style={{ position: 'absolute', bottom: 32, right: 32 }} className="md:hidden">
        <TouchableOpacity 
          activeOpacity={0.7}
          className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-lg"
          style={{ shadowColor: '#7BA96A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
        >
          <FontAwesome5 name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
