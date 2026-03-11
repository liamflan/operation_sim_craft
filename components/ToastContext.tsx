import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);

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
  let bgColor = '#374151'; // gray-700
  let iconColor = '#9ca3af';

  if (toast.type === 'error') {
    iconName = 'exclamation-circle';
    bgColor = '#991b1b'; // red-800
    iconColor = '#fca5a5';
  } else if (toast.type === 'warning') {
    iconName = 'exclamation-triangle';
    bgColor = '#854d0e'; // yellow-800
    iconColor = '#fde047';
  } else if (toast.type === 'success') {
    iconName = 'check-circle';
    bgColor = '#166534'; // green-800
    iconColor = '#86efac';
  }

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <FontAwesome5 name={iconName} size={14} color={iconColor} style={styles.icon} />
      <Text style={styles.text}>{toast.message}</Text>
      <TouchableOpacity onPress={slideOutAndDismiss} style={styles.closeBtn}>
        <FontAwesome5 name="times" size={12} color="#9ca3af" />
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
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  closeBtn: {
    marginLeft: 12,
    padding: 4,
  }
});
