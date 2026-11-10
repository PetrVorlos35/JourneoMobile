import { type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  icon: SymbolViewProps['name'];
  title: string;
  text: string;
};

// Dočasná obrazovka pro taby, které ještě nejsou navržené.
export function ComingSoon({ icon, title, text }: Props) {
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <EmptyState icon={icon} title={title} text={text} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.five },
});
