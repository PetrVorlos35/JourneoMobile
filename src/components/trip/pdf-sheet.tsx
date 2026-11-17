import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PDF_SECTIONS, type PdfSection, type PdfSections } from '@/lib/trip-pdf';

const TITLES = {
  itinerary: 'pdf.itinerary',
  packing: 'pdf.packing',
  documents: 'pdf.documents',
  budget: 'pdf.budget',
} as const satisfies Record<PdfSection, string>;

// Výběr částí do PDF (TripPdfOptionsModal na webu). Prázdné části se nenabízí.
export function PdfSheet({
  visible,
  availability,
  counts,
  busy,
  onGenerate,
  onClose,
}: {
  visible: boolean;
  availability: PdfSections;
  counts: Record<PdfSection, string>;
  busy: boolean;
  onGenerate: (sections: PdfSections) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const available = PDF_SECTIONS.filter((id) => availability[id]);
  const [selected, setSelected] = useState<PdfSections>(availability);
  // Při každém otevření zapnout všechno, co jde.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setSelected(availability);
  }

  const any = available.some((id) => selected[id]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('tripDetail.exportPdf')}
      cancelLabel={t('tripDetail.dates.cancel')}
      confirmLabel={busy ? t('app.tripDetail.pdfBusy') : t('app.tripDetail.pdfCreate')}
      confirmDisabled={!any || busy}
      onConfirm={() => onGenerate(selected)}>
      <View style={styles.content}>
        <Text style={styles.hint}>{t('pdf.selectSubtitle')}</Text>
        <View style={styles.list}>
          {available.map((id, i) => (
            <View key={id} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{t(TITLES[id])}</Text>
                <Text style={styles.count}>{counts[id]}</Text>
              </View>
              <Switch
                value={selected[id]}
                onValueChange={(value) => setSelected((s) => ({ ...s, [id]: value }))}
                trackColor={{ true: Colors.primary }}
                accessibilityLabel={t(TITLES[id])}
              />
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  hint: { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: Spacing.one },
  list: { borderRadius: Radius.large, backgroundColor: Colors.background, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 60,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: Colors.text },
  count: { fontSize: 13, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
});
