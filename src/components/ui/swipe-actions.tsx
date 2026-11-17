import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Colors } from '@/constants/theme';

export type SwipeAction = {
  label: string;
  icon: SymbolViewProps['name'];
  color: string;
  onPress: () => void;
};

// Akce přejetím doleva (Upravit, Smazat…), stejně jako u seznamu výletů.
export function SwipeActions({
  actions,
  enabled = true,
  children,
}: {
  actions: SwipeAction[];
  enabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);
  if (!enabled || actions.length === 0) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => Haptics.selectionAsync()}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                ref.current?.close();
                action.onPress();
              }}
              style={[styles.action, { backgroundColor: action.color }]}
              accessibilityLabel={action.label}>
              <SymbolView name={action.icon} size={18} tintColor="#fff" />
              <Text style={styles.label}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}>
      <View style={styles.row}>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#fff' },
  row: { backgroundColor: Colors.surface },
});
