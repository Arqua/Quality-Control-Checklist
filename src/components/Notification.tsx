import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export type NotificationType = 'success' | 'error' | 'info';

interface NotificationOptions {
  type?: NotificationType;
  message: string;
  /** Auto-dismiss delay in ms. Defaults to 3500. Pass 0 to require manual dismiss. */
  durationMs?: number;
}

interface NotificationContextValue {
  notify: (options: NotificationOptions) => void;
  dismiss: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TYPE_STYLES: Record<
  NotificationType,
  { bg: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  success: { bg: '#059669', icon: 'check-circle' },
  error: { bg: '#DC2626', icon: 'error' },
  info: { bg: '#004E89', icon: 'info' },
};

/**
 * App-wide, non-blocking toast notifications. Replaces scattered
 * `Alert.alert` calls with a single accessible, theme-consistent surface that
 * does not interrupt field workflows the way a modal dialog does.
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Required<NotificationOptions> | null>(
    null
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const dismiss = useCallback(() => {
    clearTimer();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  }, [opacity]);

  const notify = useCallback(
    ({ type = 'info', message, durationMs = 3500 }: NotificationOptions) => {
      clearTimer();
      setCurrent({ type, message, durationMs });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      if (durationMs > 0) {
        timer.current = setTimeout(() => dismiss(), durationMs);
      }
    },
    [opacity, dismiss]
  );

  useEffect(() => clearTimer, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);
  const palette = current ? TYPE_STYLES[current.type] : null;

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {current && palette && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 12,
            right: 12,
            opacity,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLabel={current.message}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: palette.bg,
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 6,
            }}
          >
            <MaterialIcons name={palette.icon} size={20} color="#fff" />
            <Text
              style={{
                color: '#fff',
                fontWeight: '600',
                fontSize: 14,
                marginLeft: 10,
                flex: 1,
              }}
            >
              {current.message}
            </Text>
            <MaterialIcons name="close" size={18} color="#ffffffaa" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
};

/**
 * Access the notification API. Throws if used outside the provider so misuse
 * is caught at development time rather than failing silently.
 */
export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
