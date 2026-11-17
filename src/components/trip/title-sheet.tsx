import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onSave: (title: string) => void;
  onClose: () => void;
};

// Přejmenování výletu v sheetu. Pole přímo v hlavičce při otevření klávesnice
// poskakovalo (průhledná hlavička + posun obsahu nad klávesnici).
export function TitleSheet({ visible, title, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(title);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setValue(title);
  }

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== title;
  const save = () => canSave && onSave(trimmed);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('tripDetail.rename')}
      cancelLabel={t('tripDetail.dates.cancel')}
      confirmLabel={t('app.common.save')}
      confirmDisabled={!canSave}
      onConfirm={save}>
      <View style={styles.content}>
        <TextInput
          value={value}
          onChangeText={setValue}
          maxLength={255}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={save}
          clearButtonMode="while-editing"
          accessibilityLabel={t('tripDetail.rename')}
          style={styles.input}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    backgroundColor: Colors.background,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
});
