import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SwipeActions } from '@/components/ui/swipe-actions';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { TripDocument } from '@/lib/api';

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
const hostOf = (url: string) => {
  const match = url.trim().match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1].replace(/^www\./, '') : url;
};

type Props = {
  documents: TripDocument[];
  readOnly: boolean;
  onAdd: (title: string, content: string) => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
};

// Odkazy a poznámky (NotesTool na webu). Záznam s adresou http(s) je odkaz, otevře se
// klepnutím; ostatní je poznámka. Přidání a úprava v sheetu, přejetím Upravit / Smazat.
export function NotesList({ documents, readOnly, onAdd, onUpdate, onDelete }: Props) {
  const { t } = useTranslation();
  // null = zavřeno, 'new' = nový záznam, jinak upravovaný záznam.
  const [editing, setEditing] = useState<TripDocument | 'new' | null>(null);

  const links = documents.filter((d) => isUrl(d.content));
  const notes = documents.filter((d) => !isUrl(d.content));

  const actions = (doc: TripDocument) => [
    {
      label: t('tripDetail.notebook.edit'),
      icon: { ios: 'pencil', android: 'edit' } as const,
      color: Colors.primary,
      onPress: () => setEditing(doc),
    },
    {
      label: t('app.common.delete'),
      icon: { ios: 'trash.fill', android: 'delete' } as const,
      color: Colors.danger,
      onPress: () => onDelete(doc.id),
    },
  ];

  return (
    <View style={styles.wrap}>
      {!readOnly && (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setEditing('new');
          }}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add' }}
            size={17}
            weight="bold"
            tintColor={Colors.primary}
          />
          <Text style={styles.addText}>{t('app.tripDetail.addDoc')}</Text>
        </Pressable>
      )}

      {documents.length === 0 && (
        <Text style={styles.empty}>{t('tripDetail.notebook.notesEmpty')}</Text>
      )}

      {links.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('tripDetail.notebook.links')} · {links.length}
          </Text>
          <View style={styles.list}>
            {links.map((doc, i) => (
              <SwipeActions key={doc.id} enabled={!readOnly} actions={actions(doc)}>
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(doc.content.trim())}
                  accessibilityRole="link"
                  accessibilityHint={t('tripDetail.documents.open')}
                  style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
                  <View style={[styles.icon, styles.iconLink]}>
                    <SymbolView
                      name={{ ios: 'globe', android: 'language' }}
                      size={18}
                      tintColor={Colors.primary}
                    />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {hostOf(doc.content)}
                    </Text>
                  </View>
                  <SymbolView
                    name={{ ios: 'arrow.up.right', android: 'open_in_new' }}
                    size={14}
                    weight="semibold"
                    tintColor={Colors.textTertiary}
                  />
                </Pressable>
              </SwipeActions>
            ))}
          </View>
        </View>
      )}

      {notes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('tripDetail.notebook.notes')} · {notes.length}
          </Text>
          <View style={styles.list}>
            {notes.map((doc, i) => (
              <SwipeActions key={doc.id} enabled={!readOnly} actions={actions(doc)}>
                <Pressable
                  onPress={() => !readOnly && setEditing(doc)}
                  disabled={readOnly}
                  style={({ pressed }) => [
                    styles.row,
                    styles.rowTop,
                    i > 0 && styles.divider,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.icon, styles.iconNote]}>
                    <SymbolView
                      name={{ ios: 'note.text', android: 'sticky_note_2' }}
                      size={18}
                      tintColor={Colors.warning}
                    />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.title}>{doc.title}</Text>
                    <Text style={styles.noteText}>{doc.content}</Text>
                  </View>
                </Pressable>
              </SwipeActions>
            ))}
          </View>
        </View>
      )}

      <DocSheet
        doc={editing}
        onClose={() => setEditing(null)}
        onSave={(title, content) => {
          if (editing === 'new') onAdd(title, content);
          else if (editing) onUpdate(editing.id, title, content);
          setEditing(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

function DocSheet({
  doc,
  onClose,
  onSave,
}: {
  doc: TripDocument | 'new' | null;
  onClose: () => void;
  onSave: (title: string, content: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // Při otevření předvyplnit upravovaný záznam (nebo prázdno pro nový).
  const [opened, setOpened] = useState<typeof doc>(null);
  if (doc !== opened) {
    setOpened(doc);
    if (doc) {
      setTitle(doc === 'new' ? '' : doc.title);
      setContent(doc === 'new' ? '' : doc.content);
    }
  }

  const valid = !!title.trim() && !!content.trim();
  const save = () => valid && onSave(title.trim(), content.trim());

  return (
    <BottomSheet
      visible={doc !== null}
      onClose={onClose}
      title={doc === 'new' ? t('app.tripDetail.addDoc') : t('app.tripDetail.editDoc')}
      cancelLabel={t('tripDetail.notebook.cancelEdit')}
      confirmLabel={t('app.common.save')}
      confirmDisabled={!valid}
      onConfirm={save}>
      <View style={styles.sheet}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={255}
          autoFocus
          returnKeyType="next"
          placeholder={t('tripDetail.notebook.composerTitle')}
          placeholderTextColor={Colors.textTertiary}
          accessibilityLabel={t('tripDetail.notebook.composerTitle')}
          style={styles.field}
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          maxLength={2000}
          multiline
          autoCapitalize="none"
          placeholder={t('tripDetail.notebook.composerContent')}
          placeholderTextColor={Colors.textTertiary}
          accessibilityLabel={t('tripDetail.notebook.composerContent')}
          textAlignVertical="top"
          style={[styles.field, styles.fieldMulti]}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.five },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 48,
    borderRadius: Radius.medium,
    backgroundColor: Colors.primarySoft,
  },
  addText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  empty: {
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  section: { gap: Spacing.two },
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
    minHeight: 60,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.surface,
  },
  rowTop: { alignItems: 'flex-start' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLink: { backgroundColor: Colors.primarySoft },
  iconNote: { backgroundColor: Colors.warningSoft },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary },
  noteText: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary },
  pressed: { opacity: 0.6 },
  sheet: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, gap: Spacing.two },
  field: {
    minHeight: 50,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    backgroundColor: Colors.background,
    fontSize: 16,
    color: Colors.text,
  },
  fieldMulti: { minHeight: 110, paddingTop: 14, paddingBottom: 14 },
});
