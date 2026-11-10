import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, isGuest, signOut } = useSession();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  const who = isGuest ? t('app.profile.guest') : name || user?.email;

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>{who}</Text>
        {!isGuest && name ? <Text style={styles.text}>{user?.email}</Text> : null}
        <Text style={styles.text}>{t('app.profile.soon')}</Text>
      </View>
      <Pressable
        onPress={signOut}
        style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
        <Text style={styles.danger}>{t('app.profile.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, gap: Spacing.four },
  pressed: { opacity: 0.7 },
  card: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  row: { alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: Colors.text },
  text: { fontSize: 14, color: Colors.textSecondary },
  danger: { fontSize: 16, fontWeight: '600', color: Colors.danger },
});
