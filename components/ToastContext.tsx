import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  category?: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { duration?: number; category?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = (message: string, type: ToastType = 'info', options?: { duration?: number; category?: string }) => {
    const duration = options?.duration ?? 3000;
    const category = options?.category;
    const id = Date.now().toString();

    setToasts(prev => {
      // If it's a planner toast, we only want one visible at a time
      let filtered = prev;
      if (category === 'planner') {
        filtered = prev.filter(t => t.category !== 'planner');
      }
      return [...filtered, { id, message, type, category }];
    });

    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={[styles.container, { top: insets.top + (Platform.OS === 'web' ? 24 : 10) }]} pointerEvents="box-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Internal Toast Item Component with Animation
const ToastItem: React.FC<{ toast: ToastProps; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const slideOutAndDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  let iconName = 'info-circle';
  let bgColor = '#f8f9fa'; // mist/ivory
  let iconColor = '#64748b'; // muted slate
  let borderColor = '#e2e8f0'; // neutral border

  if (toast.type === 'error') {
    iconName = 'exclamation-circle';
    bgColor = '#fef2f2'; // pale blush
    iconColor = '#991b1b'; // muted terracotta
    borderColor = '#fee2e2';
  } else if (toast.type === 'warning') {
    iconName = 'exclamation-triangle';
    bgColor = '#fffbeb';
    iconColor = '#92400e';
    borderColor = '#fef3c7';
  } else if (toast.type === 'success') {
    iconName = 'check-circle';
    bgColor = '#f1f5f1'; // pale sage
    iconColor = '#166534'; // green
    borderColor = '#dcfce7'; // green-tinted
  }

  return (
    <Animated.View style={[
      styles.toast, 
      { backgroundColor: bgColor, borderColor, opacity, transform: [{ translateY }] }
    ]}>
      <FontAwesome5 name={iconName} size={15} color={iconColor} style={styles.icon} />
      <Text style={styles.text}>{toast.message}</Text>
      <TouchableOpacity onPress={slideOutAndDismiss} style={styles.closeBtn}>
        <FontAwesome5 name="times" size={11} color="#374151" style={{ opacity: 0.4 }} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: Platform.OS === 'web' ? 380 : '90%',
    minWidth: Platform.OS === 'web' ? 280 : 260,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  icon: {
    marginRight: 14,
  },
  text: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  closeBtn: {
    marginLeft: 14,
    padding: 4,
  }
});
