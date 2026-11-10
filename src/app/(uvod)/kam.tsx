import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

// První krok: rovnou založí výlet, registrace přijde až později (jako zkušební režim na webu).
export default function DestinationScreen() {
  const { t } = useTranslation();
  const suggestions = t('app.destination.suggestions', { returnObjects: true });
  const { startAsGuest } = useSession();
  const [destination, setDestination] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = destination.trim();

  // Založí účet hosta na serveru (POST /auth/guest), přesměruje ochrana rout v root layoutu.
  async function create() {
    if (!value || pending) return;
    setPending(true);
    setError(null);
    try {
      await startAsGuest(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.generic'));
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.step}>{t('app.destination.step')}</Text>
          <Text style={styles.title}>{t('app.destination.title')}</Text>

          <View style={styles.field}>
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'location_on' }}
              size={20}
              tintColor={Colors.primary}
            />
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder={t('app.destination.placeholder')}
              placeholderTextColor={Colors.textTertiary}
              style={styles.input}
              autoFocus
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={create}
              accessibilityLabel={t('app.destination.title')}
            />
            {destination.length > 0 && (
              <Pressable
                onPress={() => setDestination('')}
                hitSlop={10}
                accessibilityLabel={t('app.common.clear')}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel' }}
                  size={18}
                  tintColor={Colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          <Text style={styles.label}>{t('app.destination.suggestionsLabel')}</Text>
          <View style={styles.chips}>
            {suggestions.map((place) => {
              const active = place === value;
              return (
                <Pressable
                  key={place}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDestination(place);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{place}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.hint}>{t('app.destination.hint')}</Text>
          )}
          <Pressable
            onPress={create}
            disabled={!value || pending}
            style={({ pressed }) => [
              styles.primary,
              !value && styles.primaryDisabled,
              pressed && styles.primaryPressed,
            ]}>
            {pending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.primaryText, !value && styles.primaryTextDisabled]}>
                {value
                  ? t('app.destination.plan', { place: value })
                  : t('app.destination.planTrip')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.six, paddingTop: 56, gap: Spacing.three },
  pressed: { opacity: 0.6 },

  step: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.6,
    marginBottom: Spacing.three,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 60,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  },
  input: { flex: 1, fontSize: 18, color: Colors.text, height: '100%' },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.four,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },

  footer: { paddingHorizontal: Spacing.six, paddingBottom: Spacing.two, gap: Spacing.three },
  error: { fontSize: 14, color: Colors.danger, textAlign: 'center' },
  hint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  primary: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
  },
  primaryDisabled: { backgroundColor: Colors.separator },
  primaryPressed: { opacity: 0.85 },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  primaryTextDisabled: { color: Colors.textTertiary },
});
