import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Platform, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { usePantry, PantryItem, PantryItemState, PantryItemSource, TrackMode } from '../../data/PantryContext';
import PageHeader from '../../components/PageHeader';

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBadge = ({ label, value, icon, color }: { label: string, value: string | number, icon: string, color: string }) => (
  <View className={`flex-1 flex-col justify-between p-4 md:p-5 rounded-[24px] ${color} border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] min-h-[100px]`}>
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest">{label}</Text>
      <View className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.05] items-center justify-center">
        <FontAwesome5 name={icon} size={12} color="currentColor" className="opacity-80" />
      </View>
    </View>
    <Text className="text-textMain dark:text-darktextMain font-medium text-[28px] tracking-tight leading-none">{value}</Text>
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
    <View className="flex-row items-center bg-black/[0.04] dark:bg-white/[0.05] px-2.5 py-1.5 rounded-lg self-start border border-black/[0.02] dark:border-white/[0.02]">
      <FontAwesome5 name={icon} size={9} color="#8C9A90" className="mr-1.5" />
      <Text className="text-[10px] font-bold text-textSec dark:text-darktextSec uppercase tracking-widest">{text}</Text>
    </View>
  );
};

const QuickAction = ({ label, onPress, active = false }: { label: string, onPress: () => void, active?: boolean }) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`flex-1 h-full items-center justify-center rounded-[10px] transition-all active:scale-95 ${
      active 
        ? 'bg-surface dark:bg-[#343A36] shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-none border border-black/[0.02] dark:border-white/5' 
        : 'border border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.02]'
    }`}
  >
    <Text className={`text-[12px] font-bold tracking-wide ${active ? 'text-textMain dark:text-darktextMain' : 'text-textSec/60 dark:text-darktextSec/60'}`}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PantryScreen() {
  const { pantryItems: items, updateItemState, updateItemQuantity, addManualItem } = usePantry();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' && isAddModalOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsAddModalOpen(false);
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isAddModalOpen]);

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
        <View className="mb-5 pl-2">
          <View className="flex-row items-baseline mb-1">
            <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight">
              {title}
            </Text>
            <Text className="text-textSec/60 dark:text-darktextSec/60 font-bold ml-3 text-[14px]">
              {data.length}
            </Text>
          </View>
          {subtitle && <Text className="text-textSec dark:text-darktextSec font-medium text-[14px]">{subtitle}</Text>}
          
          {helperText && (
            <View className="bg-primary/5 dark:bg-primary/10 border border-primary/20 px-5 py-4 rounded-[20px] mt-4 flex-row items-center shadow-sm">
              <FontAwesome5 name="info-circle" size={14} color="#7BA96A" className="mr-3" />
              <Text className="text-primary text-[13px] font-medium flex-1 leading-relaxed tracking-wide">
                {helperText}
              </Text>
            </View>
          )}
        </View>

        {data.length === 0 ? (
          <View className="bg-surface dark:bg-darksurface rounded-[32px] p-10 border border-black/5 dark:border-white/5 items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <FontAwesome5 name="box-open" size={24} color="#8C9A90" className="mb-4 opacity-50" />
            <Text className="text-textSec dark:text-darktextSec font-medium text-[15px] text-center">{emptyText}</Text>
          </View>
        ) : (
          <View className="bg-surface dark:bg-darksurface rounded-[32px] overflow-hidden border border-black/[0.03] dark:border-darksoftBorder shadow-[0_2px_12px_rgba(0,0,0,0.02)] py-2">
            {data.map((item, idx) => (
              <View key={item.id} className={`py-5 px-6 ${idx < data.length - 1 ? 'border-b border-black/[0.03] dark:border-darksoftBorder' : ''} ${item.state === 'out' ? 'opacity-60 grayscale' : ''}`}>
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-textMain dark:text-darktextMain text-[18px] font-medium tracking-tight mb-2.5 leading-none">
                      {item.name}
                    </Text>
                    <SourceTag source={item.source} />
                  </View>
                  
                  {/* Quantity Display */}
                  {item.trackMode === 'quantity' && item.quantity !== undefined && (
                    <View className="flex-row items-center border border-black/[0.04] dark:border-white/5 rounded-full bg-black/[0.02] dark:bg-white/[0.02] p-1">
                      <TouchableOpacity onPress={() => updateItemQuantity(item.id, -1)} className="w-9 h-9 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/5 transition-all">
                        <FontAwesome5 name="minus" size={10} color="#8C9A90" />
                      </TouchableOpacity>
                      <View className="min-w-[32px] items-center mx-1">
                        <Text className="font-bold text-[14px] text-textMain dark:text-darktextMain leading-none">{item.quantity}</Text>
                      </View>
                      <TouchableOpacity onPress={() => updateItemQuantity(item.id, 1)} className="w-9 h-9 items-center justify-center rounded-full bg-surface dark:bg-[#343A36] shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-none border border-black/[0.02] dark:border-white/5 active:scale-95 transition-all">
                        <FontAwesome5 name="plus" size={10} color="#24332D" className="dark:text-white" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* State Actions */}
                <View className="flex-row bg-black/[0.04] dark:bg-white/[0.05] p-1 rounded-[12px] self-start h-10 w-full sm:w-auto min-w-[240px]">
                  <QuickAction label="In Stock" onPress={() => updateItemState(item.id, 'in_stock')} active={item.state === 'in_stock'} />
                  <View className="w-px bg-black/[0.04] dark:bg-white/[0.04] my-2 mx-0.5" />
                  <QuickAction label="Low" onPress={() => updateItemState(item.id, 'low')} active={item.state === 'low'} />
                  <View className="w-px bg-black/[0.04] dark:bg-white/[0.04] my-2 mx-0.5" />
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
    <SafeAreaView testID="pantry-screen" className="flex-1 bg-appBg dark:bg-darkappBg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 w-full mx-auto md:max-w-4xl px-4 md:px-8 pt-10 pb-32 min-h-[90vh]">
          
          {/* Header */}
          <View className="mb-6 flex-row justify-between items-end">
            <View>
              <Text className="text-textSec dark:text-darktextSec text-[11px] font-bold uppercase tracking-widest mb-2">Home Inventory</Text>
              <Text className="text-textMain dark:text-darktextMain text-[32px] md:text-[40px] font-medium tracking-tight leading-none mb-2">
                Pantry
              </Text>
              <Text className="text-textSec dark:text-darktextSec text-[15px] font-medium max-w-[280px]">
                What Provision thinks you have at home.
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsAddModalOpen(true)}
              className="hidden md:flex bg-primary hover:bg-primary-hover active:scale-95 transition-all px-6 py-3.5 rounded-full flex-row items-center justify-center shadow-sm"
            >
              <FontAwesome5 name="plus" size={12} color="white" className="mr-3" />
              <Text className="text-white font-medium text-[15px] tracking-wide">Add item</Text>
            </TouchableOpacity>
          </View>

          {/* Integration Hint — rendered below header as a premium card */}
          <View className="mb-8 bg-surface dark:bg-darksurface border border-black/[0.03] dark:border-darksoftBorder rounded-[24px] px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-4">
              <FontAwesome5 name="robot" size={14} color="#7BA96A" />
            </View>
            <Text className="text-textSec dark:text-darktextSec text-[13.5px] font-medium flex-1 leading-relaxed">
              Items tracked here automatically shape recipe recommendations and reduce redundant purchases from your Fuel List.
            </Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3 md:gap-4 mb-12">
            <StatBadge label="Tracked" value={totalTracked} icon="boxes" color="bg-surface dark:bg-darksurface text-textSec" />
            <StatBadge label="Running low" value={runningLowCount} icon="thermometer-half" color="bg-danger/5 dark:bg-[#D97C6C]/10 text-danger dark:text-[#D97C6C] border-danger/20 dark:border-transparent" />
            <StatBadge label="Needs Check" value={needCheckingCount} icon="question" color="bg-warning/10 dark:bg-warning/5 text-textMain dark:text-white border-warning/20 dark:border-transparent" />
          </View>

          {/* Empty State protection */}
          {items.length === 0 && (
            <View className="bg-surface dark:bg-darksurface rounded-[32px] p-10 mt-4 border border-black/[0.03] dark:border-darksoftBorder items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <View className="w-20 h-20 bg-black/[0.04] dark:bg-white/[0.05] rounded-full items-center justify-center mb-6">
                <FontAwesome5 name="box-open" size={28} color="#8C9A90" />
              </View>
              <Text className="text-textMain dark:text-darktextMain text-[24px] font-medium tracking-tight mb-3">Your pantry is empty</Text>
              <Text className="text-textSec dark:text-darktextSec text-center text-[15px] font-medium mb-8 max-w-[320px] leading-relaxed">
                Future Fuel List purchases will automatically populate here. You can also manually add staples.
              </Text>
              <TouchableOpacity 
                onPress={() => setIsAddModalOpen(true)}
                className="bg-primary hover:bg-primary-hover active:scale-95 transition-all px-8 py-4 rounded-full flex-row items-center shadow-sm"
              >
                <FontAwesome5 name="plus" size={14} color="white" className="mr-3" />
                <Text className="text-white font-medium text-[16px] tracking-wide">Add first item</Text>
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
            className="md:hidden absolute bottom-6 right-4 w-15 h-15 bg-primary rounded-full items-center justify-center shadow-lg hover:bg-primary-hover"
          >
            <FontAwesome5 name="plus" size={20} color="white" />
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/40 dark:bg-black/60 justify-center items-center p-4"
        >
          <View className="bg-surface dark:bg-darksurface w-full max-w-[340px] rounded-[32px] p-7 shadow-xl border border-black/[0.05] dark:border-darksoftBorder">
            <Text className="text-textMain dark:text-darktextMain text-[22px] font-medium tracking-tight mb-1">Add Pantry Item</Text>
            <Text className="text-textSec dark:text-darktextSec text-[14px] font-medium mb-6">Track a new staple or ingredient.</Text>
            
            <View className="bg-black/[0.02] dark:bg-white/[0.02] rounded-[20px] px-5 py-4 border border-black/[0.04] dark:border-white/5 mb-8 focus-within:border-black/10 dark:focus-within:border-white/10 transition-colors">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-textSec/60 dark:text-darktextSec/60 mb-1">Item Name</Text>
              <TextInput
                autoFocus
                value={newItemName}
                onChangeText={setNewItemName}
                className="font-medium text-[16px] text-textMain dark:text-darktextMain outline-none"
                placeholder="e.g. Flour, Sugar..."
                placeholderTextColor="#8C9A90"
                onSubmitEditing={handleAddItem}
                style={{ outlineWidth: 0 } as any}
              />
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} className="flex-1 py-3.5 rounded-full items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
                <Text className="text-textSec dark:text-darktextSec font-medium text-[14px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddItem} className="flex-1 bg-primary py-3.5 rounded-full items-center justify-center shadow-sm hover:bg-primary-hover active:scale-95 transition-all">
                <Text className="text-white font-medium text-[14px]">Add to Pantry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
