import { isToday, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Activity } from '@/lib/api';
import { formatDate } from '@/lib/format';

const ITEM_WIDTH = 84;
const GAP = Spacing.two;

// Pás dnů nad stránkou dne (DayStrip na webu). Vybraný den je modrý, dnešek má tečku
// a pás se sám posune, ať vybraný den nezůstane schovaný za okrajem.
export function DayStrip({
  days,
  activeIndex,
  onSelect,
}: {
  days: Activity[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return;
    const x = activeIndex * (ITEM_WIDTH + GAP) - (width - ITEM_WIDTH) / 2 + Spacing.four;
    scroller.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [activeIndex, width]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.strip}
      accessibilityRole="tablist">
      {days.map((day, index) => {
        const date = parseISO(day.date);
        const selected = index === activeIndex;
        const today = isToday(date);
        return (
          <Pressable
            key={day.date}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(index);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${formatDate(date, 'EEEE d. MMMM')}, ${day.title}`}
            style={({ pressed }) => [
              styles.item,
              selected ? styles.itemSelected : styles.itemIdle,
              pressed && !selected && styles.pressed,
            ]}>
            <View style={styles.weekdayRow}>
              <Text style={[styles.weekday, selected && styles.onAccentSoft]}>
                {formatDate(date, 'EEEEEE')}
              </Text>
              {today && (
                <View style={styles.today}>
                  <View style={[styles.dot, selected && styles.dotSelected]} />
                  <Text style={[styles.todayText, selected && styles.onAccent]}>
                    {t('tripDetail.notebook.today')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.dayNumber, selected && styles.onAccent]}>{formatDate(date, 'd.')}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.location,
                !day.location && styles.locationEmpty,
                selected && styles.onAccentSoft,
              ]}>
              {day.location ? day.location.split(',')[0] : '—'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: GAP, paddingHorizontal: Spacing.four, paddingVertical: Spacing.one },
  item: {
    width: ITEM_WIDTH,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: Spacing.three,
  },
  itemIdle: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  itemSelected: { backgroundColor: Colors.primary },
  pressed: { opacity: 0.7 },
  weekdayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekday: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  today: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  dotSelected: { backgroundColor: '#fff' },
  todayText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  dayNumber: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  location: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, marginTop: 6 },
  locationEmpty: { color: Colors.textTertiary },
  onAccent: { color: '#fff' },
  onAccentSoft: { color: '#dbe7ff' },
});
