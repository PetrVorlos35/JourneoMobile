import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SwipeActions } from '@/components/ui/swipe-actions';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { PackingItem } from '@/lib/api';

type Props = {
  items: PackingItem[];
  readOnly: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onFocusInput: () => void;
};

// Balení (PackingTool na webu): průběh, přidání věci, „Zbývá zabalit“ a sbalené věci.
// Mazání přejetím doleva s „Vrátit“ v toastu (řeší detail výletu).
export function PackingList({ items, readOnly, onAdd, onToggle, onDelete, onFocusInput }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [showPacked, setShowPacked] = useState(true);

  const toPack = items.filter((i) => !i.checked);
  const packed = items.filter((i) => i.checked);
  const progress = items.length ? packed.length / items.length : 0;

  function submit() {
    const text = draft.trim();
    if (!text) return;
    Haptics.selectionAsync();
    onAdd(text);
    setDraft('');
  }

  const rows = (list: PackingItem[]) => (
    <View style={styles.list}>
      {list.map((item, i) => (
        <SwipeActions
          key={item.id}
          enabled={!readOnly}
          actions={[
            {
              label: t('app.common.delete'),
              icon: { ios: 'trash.fill', android: 'delete' },
              color: Colors.danger,
              onPress: () => onDelete(item.id as string),
            },
          ]}>
          <Pressable
            onPress={() => {
              if (readOnly) return;
              Haptics.selectionAsync();
              onToggle(item.id as string);
            }}
            disabled={readOnly}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.checked, disabled: readOnly }}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
            <View style={[styles.check, item.checked && styles.checkOn]}>
              {item.checked && (
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check' }}
                  size={13}
                  weight="bold"
                  tintColor="#fff"
                />
              )}
            </View>
            <Text style={[styles.text, item.checked && styles.textDone]}>{item.text}</Text>
          </Pressable>
        </SwipeActions>
      ))}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {items.length > 0 && (
        <View style={styles.progress}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {t('tripDetail.notebook.packingProgress', { done: packed.length, total: items.length })}
            </Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)} %</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      {!readOnly && (
        <View style={styles.add}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onFocus={onFocusInput}
            onSubmitEditing={submit}
            submitBehavior="submit"
            returnKeyType="done"
            maxLength={255}
            placeholder={t('tripDetail.notebook.packingPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            accessibilityLabel={t('tripDetail.notebook.packingPlaceholder')}
            style={styles.input}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            accessibilityLabel={t('tripDetail.notebook.add')}
            style={({ pressed }) => [
              styles.addButton,
              !draft.trim() && styles.addButtonDisabled,
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={{ ios: 'plus', android: 'add' }}
              size={18}
              weight="bold"
              tintColor={draft.trim() ? '#fff' : Colors.textTertiary}
            />
          </Pressable>
        </View>
      )}

      {items.length === 0 ? (
        <Text style={styles.empty}>{t('tripDetail.notebook.packingEmpty')}</Text>
      ) : (
        <>
          {toPack.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('tripDetail.notebook.toPack')} · {toPack.length}
              </Text>
              {rows(toPack)}
            </View>
          ) : (
            <Text style={styles.allPacked}>{t('tripDetail.notebook.allPacked')}</Text>
          )}

          {packed.length > 0 && (
            <View style={styles.section}>
              <Pressable
                onPress={() => setShowPacked((v) => !v)}
                accessibilityState={{ expanded: showPacked }}
                hitSlop={8}
                style={styles.sectionToggle}>
                <Text style={styles.sectionTitle}>
                  {t('tripDetail.notebook.packed')} · {packed.length}
                </Text>
                <SymbolView
                  name={
                    showPacked
                      ? { ios: 'chevron.down', android: 'expand_more' }
                      : { ios: 'chevron.right', android: 'chevron_right' }
                  }
                  size={12}
                  weight="semibold"
                  tintColor={Colors.textSecondary}
                />
              </Pressable>
              {showPacked && rows(packed)}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.five },
  progress: { gap: Spacing.two },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressText: { fontSize: 15, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  progressPercent: { fontSize: 13, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.separator, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
  add: { flexDirection: 'row', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    backgroundColor: Colors.surface,
    fontSize: 16,
    color: Colors.text,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  addButtonDisabled: { backgroundColor: Colors.separator },
  empty: {
    paddingVertical: Spacing.eight,
    textAlign: 'center',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  allPacked: { fontSize: 15, fontWeight: '600', color: Colors.success, paddingHorizontal: Spacing.one },
  section: { gap: Spacing.two },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.one,
  },
  list: { borderRadius: Radius.large, backgroundColor: Colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.surface,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text: { flex: 1, fontSize: 16, color: Colors.text },
  textDone: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },
});
