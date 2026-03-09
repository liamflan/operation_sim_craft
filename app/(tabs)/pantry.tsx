import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { usePantry, PantryItem, PantryItemState, PantryItemSource, TrackMode } from '../../data/PantryContext';
import PageHeader from '../../components/PageHeader';

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBadge = ({ label, value, icon, color }: { label: string, value: string | number, icon: string, color: string }) => (
  <View className={`flex-1 flex-row items-center px-4 py-3 rounded-2xl ${color} border border-black/5 dark:border-white/5 shadow-sm`}>
    <View className="mr-3 w-6 h-6 items-center justify-center opacity-70">
      <FontAwesome5 name={icon} size={14} color="currentColor" />
    </View>
    <View>
      <Text className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-0.5 leading-tight">{label}</Text>
      <Text className="font-extrabold text-lg leading-none">{value}</Text>
    </View>
  </View>
);

const SourceTag = ({ source }: { source: PantryItemSource }) => {
  let text = '';
  let icon = '';
  switch (source) {
    case 'added': text = 'Added by you'; icon = 'user'; break;
    case 'past_shop': text = 'From past shops'; icon = 'shopping-bag'; break;
    case 'inferred': text = 'Inferred'; icon = 'magic'; break;
  }
  return (
    <View className="flex-row items-center bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md self-start">
      <FontAwesome5 name={icon} size={8} color="#9CA3AF" className="mr-1.5" />
      <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{text}</Text>
    </View>
  );
};

const QuickAction = ({ label, onPress, active = false }: { label: string, onPress: () => void, active?: boolean }) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`py-1.5 px-3 rounded-lg transition-all ${
      active 
        ? 'bg-white dark:bg-darkgrey shadow-sm border border-black/5 dark:border-white/5' 
        : 'border border-transparent hover:bg-black/5 dark:hover:bg-white/5'
    }`}
  >
    <Text className={`text-[11px] font-bold text-center tracking-wide ${active ? 'text-charcoal dark:text-white' : 'text-gray-500'}`}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PantryScreen() {
  const { pantryItems: items, updateItemState, updateItemQuantity, addManualItem } = usePantry();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Stats
  const totalTracked = items.length;
  const runningLowCount = items.filter(i => i.state === 'low').length;
  const needCheckingCount = items.filter(i => i.state === 'need_checking').length;

  // Grouping
  const groupedItems = {
    running_low: items.filter(i => i.state === 'low'),
    need_checking: items.filter(i => i.state === 'need_checking'),
    in_stock: items.filter(i => i.state === 'in_stock'),
    out: items.filter(i => i.state === 'out'),
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    
    addManualItem(newItemName.trim());
    setNewItemName('');
    setIsAddModalOpen(false);
  };

  const renderSection = (title: string, data: PantryItem[], subtitle?: string, helperText?: string, emptyText?: string) => {
    if (data.length === 0 && !emptyText) return null;

    return (
      <View className="mb-10">
        <View className="mb-4 pl-1">
          <Text className="text-charcoal dark:text-darkcharcoal text-2xl font-extrabold tracking-tight flex-row items-center">
            {title} <Text className="text-gray-400 font-bold tracking-normal ml-2 text-lg">({data.length})</Text>
          </Text>
          {subtitle && <Text className="text-gray-500 font-semibold text-sm mt-1">{subtitle}</Text>}
          {helperText && (
            <View className="bg-avocado/10 border border-avocado/20 px-3 py-2 rounded-xl mt-3 flex-row items-start">
              <FontAwesome5 name="info-circle" size={12} color="#6DBE75" className="mt-0.5 mr-2" />
              <Text className="text-avocado text-xs font-semibold flex-1 leading-relaxed">
                {helperText}
              </Text>
            </View>
          )}
        </View>

        {data.length === 0 ? (
          <View className="bg-white/40 dark:bg-darkgrey/40 rounded-3xl p-8 border border-black/5 dark:border-white/5 items-center justify-center border-dashed">
            <FontAwesome5 name="box-open" size={24} color="#D1D5DB" className="mb-3" />
            <Text className="text-gray-500 font-bold text-sm text-center">{emptyText}</Text>
          </View>
        ) : (
          <View className="bg-white/40 dark:bg-darkgrey/40 rounded-3xl overflow-hidden border border-black/5 dark:border-white/5 shadow-sm">
            {data.map((item, idx) => (
              <View key={item.id} className={`py-4 px-5 border-b border-black/5 dark:border-white/5 last:border-0 ${item.state === 'out' ? 'opacity-70' : ''}`}>
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1 pr-4">
                    <Text className="text-charcoal dark:text-darkcharcoal text-base font-extrabold tracking-tight mb-1.5 leading-none">
                      {item.name}
                    </Text>
                    <SourceTag source={item.source} />
                  </View>
                  
                  {/* Quantity Display */}
                  {item.trackMode === 'quantity' && item.quantity !== undefined && (
                    <View className="flex-row items-center border border-black/5 dark:border-white/10 rounded-full bg-black/[0.02] dark:bg-white/5 p-0.5">
                      <TouchableOpacity onPress={() => updateItemQuantity(item.id, -1)} className="w-8 h-8 items-center justify-center rounded-full active:bg-black/10 dark:active:bg-white/10 transition-all">
                        <FontAwesome5 name="minus" size={10} color="#9CA3AF" />
                      </TouchableOpacity>
                      <View className="min-w-[32px] items-center mx-1">
                        <Text className="font-extrabold text-sm text-charcoal dark:text-white leading-none">{item.quantity}</Text>
                      </View>
                      <TouchableOpacity onPress={() => updateItemQuantity(item.id, 1)} className="w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-darkgrey shadow-sm border border-black/5 dark:border-white/10 active:opacity-80 transition-all">
                        <FontAwesome5 name="plus" size={10} color="#71717a" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* State Actions */}
                <View className="flex-row bg-black/5 dark:bg-white/5 p-1 rounded-xl self-start mt-0.5">
                  <QuickAction label="In Stock" onPress={() => updateItemState(item.id, 'in_stock')} active={item.state === 'in_stock'} />
                  <QuickAction label="Low" onPress={() => updateItemState(item.id, 'low')} active={item.state === 'low'} />
                  <QuickAction label="Out" onPress={() => updateItemState(item.id, 'out')} active={item.state === 'out'} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView testID="pantry-screen" className="flex-1 bg-cream dark:bg-darkcream">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header */}
          <PageHeader 
            eyebrow="Home Inventory"
            title="Pantry"
            subtitle="What Provision thinks you already have at home."
            rightActions={
              <TouchableOpacity 
                onPress={() => setIsAddModalOpen(true)}
                className="bg-avocado/10 border border-avocado/20 px-4 py-2.5 rounded-xl flex-row items-center active:bg-avocado/20 transition-all hidden md:flex mt-1"
              >
                <FontAwesome5 name="plus" size={12} color="#6DBE75" className="mr-2" />
                <Text className="text-avocado font-bold text-sm">Add item</Text>
              </TouchableOpacity>
            }
          />

          {/* Integration Hint — rendered below header as a page-level block */}
          <View className="flex-row items-start mb-8 bg-white/50 dark:bg-darkgrey/40 border border-black/5 dark:border-white/5 rounded-2xl px-4 py-3 shadow-sm">
            <FontAwesome5 name="robot" size={11} color="#6DBE75" className="mt-0.5 mr-3" />
            <Text className="text-gray-500 text-xs font-semibold flex-1 leading-relaxed">
              Items tracked here automatically shape your recipe recommendations and reduce redundant purchases from your Fuel List.
            </Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row flex-wrap gap-3 mb-12">
            <StatBadge label="Total tracked" value={totalTracked} icon="boxes" color="bg-white dark:bg-darkgrey text-charcoal dark:text-white" />
            <StatBadge label="Running low" value={runningLowCount} icon="thermometer-half" color="bg-tomato/10 text-tomato" />
            <StatBadge label="Need checking" value={needCheckingCount} icon="question-circle" color="bg-blueberry/10 text-blueberry" />
          </View>

          {/* Empty State protection */}
          {items.length === 0 && (
            <View className="bg-white/40 dark:bg-darkgrey/40 rounded-3xl p-8 border border-black/5 dark:border-white/5 items-center justify-center mt-4">
              <View className="w-16 h-16 bg-white dark:bg-darkgrey rounded-2xl items-center justify-center shadow-sm mb-4">
                <FontAwesome5 name="box-open" size={24} color="#6DBE75" />
              </View>
              <Text className="text-charcoal dark:text-white text-xl font-extrabold tracking-tight mb-2">Your pantry is empty</Text>
              <Text className="text-gray-500 text-center text-sm font-medium mb-6 max-w-xs">
                Future Fuel List purchases will automatically populate here. You can also manually add staples.
              </Text>
              <TouchableOpacity 
                onPress={() => setIsAddModalOpen(true)}
                className="bg-avocado px-6 py-3 rounded-xl flex-row items-center"
              >
                <FontAwesome5 name="plus" size={12} color="white" className="mr-2" />
                <Text className="text-white font-bold">Add first item</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sections */}
          {items.length > 0 && (
            <View>
              {renderSection("Running Low", groupedItems.running_low, "Consider replenishing these soon.")}
              {renderSection("Need Checking", groupedItems.need_checking, undefined, "Provision inferred these from past shops, but they may need confirming.")}
              {renderSection("In Stock", groupedItems.in_stock)}
              {renderSection("Out", groupedItems.out, "Used up or unavailable.")}
            </View>
          )}

          {/* Mobile floating FAB */}
          <TouchableOpacity 
            onPress={() => setIsAddModalOpen(true)}
            className="md:hidden absolute bottom-6 right-4 w-14 h-14 bg-avocado rounded-full items-center justify-center shadow-lg"
          >
            <FontAwesome5 name="plus" size={20} color="white" />
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="bg-cream dark:bg-darkgrey w-full max-w-sm rounded-3xl p-6 shadow-xl border border-black/5 dark:border-white/10">
            <Text className="text-charcoal dark:text-white text-2xl font-extrabold tracking-tight mb-2">Add Pantry Item</Text>
            <Text className="text-gray-500 text-sm font-medium mb-6">Track a new staple or ingredient.</Text>
            
            <View className="bg-white dark:bg-black/20 rounded-2xl px-4 py-3 border border-black/5 dark:border-white/10 mb-6">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Item Name</Text>
              <TextInput
                autoFocus
                value={newItemName}
                onChangeText={setNewItemName}
                className="font-extrabold text-lg text-charcoal dark:text-white"
                placeholder="e.g. Flour, Sugar..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={handleAddItem}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} className="flex-1 py-3 px-4 rounded-xl border border-black/10 dark:border-white/10 items-center">
                <Text className="text-gray-600 dark:text-gray-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddItem} className="flex-1 bg-avocado py-3 px-4 rounded-xl items-center shadow-sm">
                <Text className="text-white font-bold">Add to Pantry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
