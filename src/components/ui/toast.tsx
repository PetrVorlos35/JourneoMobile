import * as Haptics from 'expo-haptics';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

type ToastOptions = {
  message: string;
  action?: { label: string; onPress: () => void };
  duration?: number;
};

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  // Smazání s možností vrátit: „Výlet smazán · Vrátit“.
  showUndo: (message: string, onUndo: () => void) => void;
  hide: () => void;
};

// Nad spodní lištou s taby (49 pt + okraj).
const TAB_BAR_OFFSET = 60;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      nextId.current += 1;
      setToast({ ...options, id: nextId.current });
      AccessibilityInfo.announceForAccessibility(options.message);
      // S akcí déle, ať se na „Vrátit“ stihne kliknout.
      timer.current = setTimeout(hide, options.duration ?? (options.action ? 5000 : 3000));
    },
    [hide],
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void) =>
      show({ message, action: { label: t('app.common.undo'), onPress: onUndo } }),
    [show, t],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext value={{ show, showUndo, hide }}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.layer, { bottom: insets.bottom + TAB_BAR_OFFSET }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(180)}
            style={styles.toast}
            accessibilityLiveRegion="polite">
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  Haptics.selectionAsync();
                  toast.action?.onPress();
                  hide();
                }}>
                <Text style={styles.action}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </ToastContext>
  );
}

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast musí být uvnitř ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: Spacing.four, right: Spacing.four },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    minHeight: 50,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.text,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
  },
  message: { flex: 1, fontSize: 15, lineHeight: 20, color: '#fff' },
  action: { fontSize: 15, fontWeight: '600', color: '#8fb3ff' },
});
