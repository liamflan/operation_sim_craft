import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, TextInput, Dimensions, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Intelligence sub-components
const PantrySection = ({ title, items, onInfoPress }: { title: string, items: string[], onInfoPress?: (item: string) => void }) => (
  <View className="mb-10 last:mb-0">
    <View className="flex-row justify-between items-baseline mb-5 px-1">
      <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-[0.2em]">{title}</Text>
      <Text className="text-textSec/40 dark:text-darktextSec/40 text-[10px] font-medium">{items.length} items tracked</Text>
    </View>
    <View className="bg-surface dark:bg-darksurface rounded-[28px] overflow-hidden border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
      {items.map((item, idx) => (
        <TouchableOpacity 
          key={item} 
          onPress={() => onInfoPress?.(item)}
          activeOpacity={0.7}
          className={`flex-row items-center justify-between px-6 py-5 ${idx < items.length - 1 ? 'border-b border-black/[0.03] dark:border-darksoftBorder' : ''} hover:bg-black/[0.01] dark:hover:bg-white/[0.01] group`}
        >
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-primary/20 mr-4" />
            <Text className="text-textMain dark:text-darktextMain text-[17px] font-medium tracking-tight group-hover:text-primary">{item}</Text>
          </View>
          <View className="flex-row items-center">
             <View className="bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 rounded-lg mr-4 border border-black/[0.01] dark:border-white/[0.01]">
                <Text className="text-textSec/50 dark:text-darktextSec/50 text-[10px] font-bold uppercase tracking-widest">In Stock</Text>
             </View>
             <FontAwesome5 name="chevron-right" size={10} color="#CBD5E3" />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const QuickAction = ({ icon, label, color, onPress }: { icon: string, label: string, color: string, onPress: () => void }) => (
  <TouchableOpacity 
    onPress={onPress}
    activeOpacity={0.7}
    className="items-center justify-center bg-surface dark:bg-darksurface w-[100px] h-[100px] rounded-[24px] border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] p-2"
  >
    <View className={`w-10 h-10 rounded-full ${color} items-center justify-center mb-2.5`}>
      <FontAwesome5 name={icon} size={14} color="white" />
    </View>
    <Text className="text-textMain dark:text-darktextMain text-[13px] font-medium text-center leading-tight tracking-tight">{label}</Text>
  </TouchableOpacity>
);

export default function PantryScreen() {
  const [search, setSearch] = useState('');
  
  const pantrySections = [
    { title: 'Staples & Condiments', items: ['Olive Oil', 'Salt & Pepper', 'Balsamic Vinegar', 'Soy Sauce', 'Honey'] },
    { title: 'Dry Goods', items: ['Basmati Rice', 'Red Lentils', 'Quinoa', 'Wholewheat Pasta', 'Chickpeas (Canned)'] },
    { title: 'Spices', items: ['Smoked Paprika', 'Cumin', 'Turmeric', 'Coriander Seeds', 'Chilli Flakes'] },
  ];

  return (
    <SafeAreaView className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header Section */}
          <View className="mb-10 px-1">
            <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-[0.25em] mb-3">Kitchen Inventory</Text>
            <View className="flex-row justify-between items-end">
              <View className="flex-1 pr-6">
                <Text className="text-textMain dark:text-darktextMain text-[36px] font-medium tracking-tighter leading-none mb-4">Pantry</Text>
                <Text className="text-textSec dark:text-darktextSec text-[15px] font-medium leading-relaxed opacity-70">Provision keeps track of what you already have so you never buy duplicates.</Text>
              </View>
              <View className="sm:hidden -mb-1">
                 <View className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                   <Text className="text-primary font-bold text-[11px] uppercase tracking-wider">{pantrySections.reduce((acc, s) => acc + s.items.length, 0)} Items</Text>
                 </View>
              </View>
            </View>
          </View>

          {/* Intelligent Search Area */}
          <View className="mb-12">
            <View className="flex-row items-center bg-surface dark:bg-darksurface rounded-[24px] px-6 h-16 border border-black/[0.04] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-8 focus-within:border-primary/30">
              <FontAwesome5 name="search" size={12} color="#8C9A90" className="mr-5" />
              <TextInput 
                placeholder="Search your pantry or add a new staple..."
                value={search}
                onChangeText={setSearch}
                className="flex-1 text-textMain dark:text-darktextMain text-[16px] font-medium outline-none"
                style={{ outlineWidth: 0 } as any}
                placeholderTextColor="#A0A8A2"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7} className="w-8 h-8 items-center justify-center bg-black/[0.04] dark:bg-white/10 rounded-full">
                  <FontAwesome5 name="times" size={10} color="#8C9A90" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-row justify-between">
              <QuickAction icon="plus" label="Add New" color="bg-primary" onPress={() => {}} />
              <QuickAction icon="barcode" label="Scan Code" color="bg-blueberry" onPress={() => {}} />
              <QuickAction icon="shopping-cart" label="Import" color="bg-peach" onPress={() => {}} />
              <QuickAction icon="sync" label="Inventory" color="bg-avocado" onPress={() => {}} />
            </View>
          </View>

          {/* Synthesis Areas */}
          <View>
             {pantrySections.map((section) => (
                <PantrySection 
                  key={section.title} 
                  title={section.title} 
                  items={section.items.filter(item => item.toLowerCase().includes(search.toLowerCase()))} 
                />
             ))}
          </View>

          {/* Inventory Insights Area */}
          <View className="mt-12 bg-white/40 dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 rounded-[32px] p-8 items-center">
             <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-5">
               <FontAwesome5 name="lightbulb" size={16} color="#7BA96A" />
             </View>
             <Text className="text-textMain dark:text-darktextMain text-[16px] font-semibold mb-2">Automated Inventory</Text>
             <Text className="text-textSec dark:text-darktextSec text-[13px] text-center leading-relaxed">
               When you purchase a meal plan, Provision automatically tags ingredients as 'In Stock'. You can toggle individual items to 'Out of Stock' for granular control.
             </Text>
          </View>

        </View>
      </ScrollView>

      {/* Floating Action for native simplicity */}
      <View style={{ position: 'absolute', bottom: 32, right: 32 }} className="md:hidden">
        <TouchableOpacity 
          activeOpacity={0.7}
          className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-lg active:scale-95"
          style={{ shadowColor: '#7BA96A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
        >
          <FontAwesome5 name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
