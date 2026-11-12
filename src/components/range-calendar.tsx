import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { currentLanguage } from '@/lib/i18n';
import { toIsoDate } from '@/lib/trip';

type Props = {
  startDate: string | null;
  endDate: string | null;
  minDate: Date;
  // Nejdelší výlet ve dnech; po výběru začátku jsou dny za limitem zašedlé.
  maxDays: number;
  onChange: (range: { startDate: string | null; endDate: string | null }) => void;
};

const CELL_HEIGHT = 44;
// Vždy 6 řádků, ať kalendář při přejetí na jiný měsíc neposkakuje.
const ROWS = 6;
const MONTHS_AHEAD = 24;

// Jeden kalendář na celý termín: první klepnutí je začátek, druhé konec.
// Mezi měsíci se přejíždí prstem do stran (nebo šipkami v hlavičce).
export function RangeCalendar({ startDate, endDate, minDate, maxDays, onChange }: Props) {
  const locale = currentLanguage() === 'cs' ? cs : enUS;
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Date>>(null);

  const months = useMemo(() => {
    const first = startOfMonth(minDate);
    const count = differenceInCalendarMonths(new Date(), first) + MONTHS_AHEAD + 1;
    return Array.from({ length: count }, (_, i) => addMonths(first, i));
  }, [minDate]);

  const initialIndex = useMemo(() => {
    const target = startDate ? parseISO(startDate) : new Date();
    return Math.max(0, differenceInCalendarMonths(target, months[0]));
    // Jen při prvním vykreslení, pak měsíc řídí uživatel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);
  const [index, setIndex] = useState(initialIndex);

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;
  const today = startOfDay(new Date());
  const lastAllowed = start && !end ? addDays(start, maxDays - 1) : null;

  const select = useCallback(
    (day: Date) => {
      Haptics.selectionAsync();
      const iso = toIsoDate(day);
      // Nový výběr: hotový rozsah, nic, nebo klepnutí před začátek.
      if (!start || end || isBefore(day, start)) onChange({ startDate: iso, endDate: null });
      else onChange({ startDate: startDate, endDate: iso });
    },
    [start, end, startDate, onChange],
  );

  const weekdays = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'EEEEEE', { locale }));
  }, [locale]);

  function go(delta: number) {
    const next = Math.min(Math.max(index + delta, 0), months.length - 1);
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }

  const title = format(months[index], 'LLLL yyyy', { locale });

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <Text style={styles.month}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        <View style={styles.arrows}>
          <Arrow dir="left" disabled={index === 0} onPress={() => go(-1)} />
          <Arrow dir="right" disabled={index === months.length - 1} onPress={() => go(1)} />
        </View>
      </View>
      <View style={styles.weekdays}>
        {weekdays.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {width > 0 && (
        <FlatList
          ref={list}
          data={months}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(m) => m.toISOString()}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          windowSize={3}
          initialNumToRender={1}
          extraData={`${startDate}|${endDate}`}
          renderItem={({ item }) => (
            <Month
              month={item}
              width={width}
              start={start}
              end={end}
              today={today}
              minDate={minDate}
              lastAllowed={lastAllowed}
              onSelect={select}
            />
          )}
        />
      )}
    </View>
  );
}

function Arrow({
  dir,
  disabled,
  onPress,
}: {
  dir: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={styles.arrow}>
      <SymbolView
        name={
          dir === 'left'
            ? { ios: 'chevron.left', android: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right' }
        }
        size={17}
        weight="semibold"
        tintColor={disabled ? Colors.textTertiary : Colors.primary}
      />
    </Pressable>
  );
}

type MonthProps = {
  month: Date;
  width: number;
  start: Date | null;
  end: Date | null;
  today: Date;
  minDate: Date;
  lastAllowed: Date | null;
  onSelect: (day: Date) => void;
};

const Month = memo(function Month({
  month,
  width,
  start,
  end,
  today,
  minDate,
  lastAllowed,
  onSelect,
}: MonthProps) {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const last = endOfMonth(month);
  const cell = width / 7;

  return (
    <View style={{ width, height: CELL_HEIGHT * ROWS }}>
      {Array.from({ length: ROWS }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: 7 }, (_, col) => {
            const day = addDays(first, row * 7 + col);
            const inMonth = day.getMonth() === month.getMonth() && !isAfter(day, last);
            if (!inMonth) return <View key={col} style={{ width: cell, height: CELL_HEIGHT }} />;

            const disabled =
              isBefore(day, minDate) || (lastAllowed !== null && isAfter(day, lastAllowed));
            const isStart = !!start && isSameDay(day, start);
            const isEnd = !!end && isSameDay(day, end);
            const between = !!start && !!end && isAfter(day, start) && isBefore(day, end);
            const edge = isStart || isEnd;
            // Pás mezi začátkem a koncem; u krajních dnů jen poloviční, ať navazuje na kolečko.
            const band = between || (edge && !!end && !isSameDay(start!, end));

            return (
              <Pressable
                key={col}
                disabled={disabled}
                onPress={() => onSelect(day)}
                accessibilityRole="button"
                accessibilityLabel={format(day, 'PPPP', {
                  locale: currentLanguage() === 'cs' ? cs : enUS,
                })}
                accessibilityState={{ selected: edge || between, disabled }}
                style={{ width: cell, height: CELL_HEIGHT, justifyContent: 'center' }}>
                {band && (
                  <View
                    style={[
                      styles.band,
                      isStart && { left: cell / 2 },
                      isEnd && { right: cell / 2 },
                    ]}
                  />
                )}
                <View style={[styles.day, edge && styles.dayEdge]}>
                  <Text
                    style={[
                      styles.dayText,
                      isSameDay(day, today) && styles.today,
                      between && styles.dayBetween,
                      edge && styles.dayEdgeText,
                      disabled && styles.dayDisabled,
                    ]}>
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.three,
  },
  month: { fontSize: 17, fontWeight: '600', color: Colors.text },
  arrows: { flexDirection: 'row', gap: Spacing.five },
  arrow: { padding: 4 },
  weekdays: { flexDirection: 'row', paddingBottom: Spacing.one },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 4,
    backgroundColor: Colors.primarySoft,
  },
  day: {
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEdge: { backgroundColor: Colors.primary },
  dayText: { fontSize: 16, color: Colors.text, fontVariant: ['tabular-nums'] },
  today: { color: Colors.primary, fontWeight: '700' },
  dayBetween: { color: Colors.primary },
  dayEdgeText: { color: '#fff', fontWeight: '600' },
  dayDisabled: { color: Colors.textTertiary, opacity: 0.5 },
});
