import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

const OPEN_MS = 280;
const CLOSE_MS = 200;
const OFFSCREEN = 900;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  children: ReactNode;
};

// Spodní sheet vysoký jen podle obsahu (Modal pageSheet je vždy skoro přes celou obrazovku).
// Nahoře Zrušit · název · Uložit, zavře ho i klepnutí vedle. S klávesnicí se zvedne nad ni.
export function BottomSheet({
  visible,
  onClose,
  title,
  cancelLabel,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Po zavření zůstane sheet chvíli vykreslený, ať stihne odjet dolů.
  const [mounted, setMounted] = useState(visible);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: reducedMotion ? 0 : OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    progress.value = withTiming(0, { duration: reducedMotion ? 0 : CLOSE_MS });
    const timer = setTimeout(() => setMounted(false), reducedMotion ? 0 : CLOSE_MS);
    return () => clearTimeout(timer);
  }, [visible, progress, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * OFFSCREEN }],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }, sheetStyle]}
            accessibilityViewIsModal>
            <View style={styles.grabber} />
            <View style={styles.bar}>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
              <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              <Pressable
                onPress={onConfirm}
                disabled={confirmDisabled}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.confirm,
                  confirmDisabled && styles.confirmDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.confirmText, confirmDisabled && styles.confirmTextDisabled]}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: '#000' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.two,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.separator,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: Colors.text },
  cancel: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.two },
  cancelText: { fontSize: 17, color: Colors.primary },
  confirm: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  confirmDisabled: { backgroundColor: Colors.separator },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  confirmTextDisabled: { color: Colors.textTertiary },
  pressed: { opacity: 0.6 },
});
