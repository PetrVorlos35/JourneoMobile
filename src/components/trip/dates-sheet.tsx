import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RangeCalendar } from '@/components/range-calendar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Colors, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { MAX_TRIP_DAYS, MIN_TRIP_DATE } from '@/lib/trip';

type Range = { startDate: string | null; endDate: string | null };

type Props = {
  visible: boolean;
  startDate: string;
  endDate: string;
  // Co se stane s programem (lost / moved / kept), spočítá detail výletu.
  describe: (startDate: string, endDate: string) => { text: string; warn: boolean } | null;
  onSave: (startDate: string, endDate: string) => void;
  onClose: () => void;
};

// Změna termínu výletu (TripDatesEditor na webu): kalendář s rozsahem,
// pod ním nový termín a co se stane s programem.
export function DatesSheet({ visible, startDate, endDate, describe, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>({ startDate, endDate });
  // Při každém otevření začne výběr od uloženého termínu.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setRange({ startDate, endDate });
  }

  const from = range.startDate ? parseISO(range.startDate) : null;
  const to = range.endDate ? parseISO(range.endDate) : null;
  const days = from && to ? differenceInCalendarDays(to, from) + 1 : 0;
  const complete = !!(range.startDate && range.endDate);
  const unchanged = range.startDate === startDate && range.endDate === endDate;
  const note =
    complete && !unchanged ? describe(range.startDate as string, range.endDate as string) : null;
  const canSave = complete && !unchanged && days <= MAX_TRIP_DAYS;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('tripDetail.dates.edit')}
      cancelLabel={t('tripDetail.dates.cancel')}
      confirmLabel={t('app.common.save')}
      confirmDisabled={!canSave}
      onConfirm={() => canSave && onSave(range.startDate as string, range.endDate as string)}>
      <View style={styles.content}>
        {/* Zavřený Modal obsah odmontuje, kalendář tak vždy začne na měsíci výletu. */}
        <RangeCalendar
          startDate={range.startDate}
          endDate={range.endDate}
          minDate={MIN_TRIP_DATE}
          maxDays={MAX_TRIP_DAYS}
          onChange={setRange}
        />

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {from && to
              ? `${formatDate(from, 'EEEEEE d. M.')} – ${formatDate(to, 'EEEEEE d. M. yyyy')} · ${t(
                  'tripDetail.notebook.days',
                  { count: days },
                )}`
              : from
                ? t('tripDetail.dates.pickEnd', { date: formatDate(from, 'EEEEEE d. M.') })
                : t('tripDetail.dates.pick')}
          </Text>
          {note && <Text style={[styles.note, note.warn && styles.noteWarn]}>{note.text}</Text>}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, gap: Spacing.four },
  summary: { gap: Spacing.two, paddingHorizontal: Spacing.one, minHeight: 64 },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  note: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  noteWarn: { color: Colors.danger },
});
