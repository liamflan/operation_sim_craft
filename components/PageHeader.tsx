import React from 'react';
import { View, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode;
  bottomContent?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  rightActions,
  bottomContent,
  className = '',
}: PageHeaderProps) {
  return (
    <View className={`mb-10 pl-1 ${className}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-4">
          
          {/* Eyebrow */}
          {eyebrow && (
            <View className="flex-row items-center mb-2">
              <View className="w-2 h-2 rounded-full bg-avocado mr-3" />
              <Text className="text-avocado text-xs font-bold uppercase tracking-[0.2em]">
                {eyebrow}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text className="text-charcoal dark:text-darkcharcoal text-4xl md:text-5xl font-extrabold tracking-tight">
            {title}
          </Text>

          {/* Subtitle */}
          {subtitle && (
            <Text className="text-gray-500 text-lg md:text-xl font-medium mt-2 leading-relaxed">
              {subtitle}
            </Text>
          )}

        </View>

        {/* Right Actions Slot */}
        {rightActions && (
          <View className="mt-1 md:mt-2">
            {rightActions}
          </View>
        )}
      </View>

      {/* Bottom Content Slot (Optional context area) */}
      {bottomContent && (
        <View className={subtitle ? "mt-4 md:mt-5" : "mt-3"}>
          {bottomContent}
        </View>
      )}
    </View>
  );
}
