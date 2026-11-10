import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type StateAction = { label: string; onPress: () => void };

type Props = {
  icon: SymbolViewProps['name'];
  title: string;
  text?: string;
  action?: StateAction;
  tone?: 'primary' | 'danger';
};

// Karta pro prázdný seznam (a základ chybového stavu): ikona, nadpis, věta, akce.
export function EmptyState({ icon, title, text, action, tone = 'primary' }: Props) {
  const danger = tone === 'danger';
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <SymbolView name={icon} size={26} tintColor={danger ? Colors.danger : Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.eight,
    paddingHorizontal: Spacing.six,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.primarySoft,
    marginBottom: Spacing.two,
  },
  iconWrapDanger: { backgroundColor: '#fdecec' },
  title: { fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center' },
  button: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    height: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
});
