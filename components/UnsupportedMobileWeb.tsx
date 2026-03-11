import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from './ThemeContext';

interface UnsupportedMobileWebProps {
  onBypass: () => void;
  config?: {
    desktopUrl?: string;
    previewBuildUrl?: string;
    expoGoInstructions?: string;
    appStoreUrl?: string;
    playStoreUrl?: string;
  };
}

export default function UnsupportedMobileWeb({ 
  onBypass, 
  config = {} 
}: UnsupportedMobileWebProps) {
  const { isDarkMode } = useTheme();

  return (
    <View className={`flex-1 items-center justify-center p-6 ${isDarkMode ? 'bg-darkappBg' : 'bg-appBg'}`}>
      <Text className="font-brand text-3xl mb-4 text-center text-text dark:text-darkText">
        Provision
      </Text>
      
      <Text className="font-sans text-lg text-center text-textMuted dark:text-darkTextMuted mb-10 leading-7 max-w-sm">
        Provision currently supports desktop web and the mobile app.{'\n\n'}
        Mobile web is not supported yet.
      </Text>

      {/* Dynamic CTA Section */}
      <View className="w-full max-w-sm gap-4 mb-16">
        {config.previewBuildUrl && (
          <TouchableOpacity 
            onPress={() => Linking.openURL(config.previewBuildUrl!)}
            className="bg-brand py-4 rounded-xl items-center shadow-sm"
          >
            <Text className="font-sans text-white text-base font-medium">Download Preview Build</Text>
          </TouchableOpacity>
        )}

        {config.appStoreUrl && (
          <TouchableOpacity 
            onPress={() => Linking.openURL(config.appStoreUrl!)}
            className="bg-surface border border-border py-4 rounded-xl items-center dark:bg-darkSurface dark:border-darkBorder"
          >
            <Text className="font-sans text-text dark:text-darkText text-base font-medium">Get it on iOS</Text>
          </TouchableOpacity>
        )}

        {config.playStoreUrl && (
          <TouchableOpacity 
            onPress={() => Linking.openURL(config.playStoreUrl!)}
            className="bg-surface border border-border py-4 rounded-xl items-center dark:bg-darkSurface dark:border-darkBorder"
          >
            <Text className="font-sans text-text dark:text-darkText text-base font-medium">Get it on Android</Text>
          </TouchableOpacity>
        )}

        {config.expoGoInstructions && (
          <View className="bg-surface/60 p-5 rounded-xl border border-border dark:bg-darkSurface/60 dark:border-darkBorder items-center">
            <Text className="font-sans text-sm font-semibold text-center text-text dark:text-darkText">
              Developer / Tester Mode
            </Text>
            <Text className="font-sans text-sm text-center text-textMuted dark:text-darkTextMuted mt-2 leading-5">
              {config.expoGoInstructions}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity onPress={onBypass} className="mt-auto mb-8 p-4 items-center">
        <Text className="font-sans text-sm text-textMuted dark:text-darkTextMuted mb-2 underline">
          Continue anyway
        </Text>
        <Text className="font-sans text-xs text-textMuted/60 dark:text-darkTextMuted/60 text-center px-4 leading-4">
          The desktop UI may not work correctly on mobile web.
        </Text>
      </TouchableOpacity>
    </View>
  );
}
