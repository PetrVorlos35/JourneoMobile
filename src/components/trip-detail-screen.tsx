import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MenuView } from '@expo/ui/community/menu';
import { SegmentedControl } from '@expo/ui/community/segmented-control';

import { DatesSheet } from '@/components/trip/dates-sheet';
import { DayPage } from '@/components/trip/day-page';
import { DayStrip } from '@/components/trip/day-strip';
import { NotesList } from '@/components/trip/notes-list';
import { PackingList } from '@/components/trip/packing-list';
import { PdfSheet } from '@/components/trip/pdf-sheet';
import { TitleSheet } from '@/components/trip/title-sheet';
import { WelcomeChecklist, type WelcomeTask } from '@/components/trip/welcome-checklist';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ApiError, type Trip } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { localId, useTripEditor, type SaveState } from '@/lib/trip-editor';
import { planDateChange, shiftDailyPlans, tripColor } from '@/lib/trip';
import { useSession } from '@/lib/session';
import { exportTripPdf, pdfAvailability, type PdfSections } from '@/lib/trip-pdf';
import { reportError } from '@/lib/telemetry';
import { useTrips } from '@/lib/trips';
import { useWelcome } from '@/lib/welcome';

const WEB_URL = 'https://journeo.vorlos.eu';

type View_ = 'program' | 'packing' | 'documents';

export function TripDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, loading, error, reload } = useTrips();
  const trip = trips?.find((tr) => tr.id === id);

  let body;
  if (loading && !trips) {
    body = (
      <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Skeleton width="70%" height={30} />
          <Skeleton width="50%" height={15} />
        </View>
        <View style={styles.stripSkeleton}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={84} height={86} radius={Radius.medium} />
          ))}
        </View>
        <View style={styles.pageWrap}>
          <Skeleton height={320} radius={Radius.large} />
        </View>
      </ScrollView>
    );
  } else if (error && !trips) {
    body = <ErrorState error={error} onRetry={reload} />;
  } else if (!trip) {
    body = (
      <EmptyState
        icon={{ ios: 'questionmark.folder', android: 'folder_off' }}
        title={t('tripDetail.notFound')}
        text={t('app.tripDetail.notFound')}
      />
    );
  } else {
    // Jiný výlet = nový rozepsaný stav (klíč přemontuje editor).
    body = <TripEditor key={trip.id} trip={trip} />;
  }

  return (
    <>
      {/* Neprůhledná hlavička: obsah začíná pod ní a iOS nemá co přepočítávat. S průhlednou
          se automatické odsazení při otevření sheetu ztrácelo a obsah odskočil pod hlavičku. */}
      <Stack.Screen
        options={{
          title: '',
          headerLargeTitleEnabled: false,
          headerTransparent: false,
          headerBlurEffect: undefined,
          headerStyle: { backgroundColor: Colors.background },
          // Jen šipka zpět, ať se přepínač uprostřed lišty vejde.
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {body}
    </>
  );
}

// Detail výletu jako zápisník na webu: hlavička s názvem a termínem, pás dnů, stránka dne.
function TripEditor({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const { draft, update, saveState, retry } = useTripEditor(trip);
  const readOnly = trip.role === 'viewer';
  const [datesOpen, setDatesOpen] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [view, setView] = useState<View_>('program');
  const toast = useToast();
  const { welcome, dismiss: dismissWelcome } = useWelcome(trip.id);
  const { user } = useSession();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Posun obsahu nad klávesnici jen při psaní do stránky dne. Jinak by ScrollView
  // reagoval i na klávesnici ze sheetu (přejmenování) a detail za ním odskočil.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => sub.remove();
  }, []);

  // Sheet otevřít až po schování klávesnice, ať její zavření a otevření
  // (pole v sheetu) nepřepočítá odsazení stránky.
  function openSheet(open: () => void) {
    Haptics.selectionAsync();
    if (!Keyboard.isVisible()) return open();
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      sub.remove();
      open();
    });
    Keyboard.dismiss();
  }

  // Probíhající výlet otevře dnešek, jinak první den.
  const [dayIndex, setDayIndex] = useState(() => {
    const today = differenceInCalendarDays(startOfDay(new Date()), parseISO(trip.startDate));
    return today >= 0 && today < draft.activities.length ? today : 0;
  });
  const days = draft.activities;
  const safeIndex = Math.min(dayIndex, days.length - 1);
  const day = days[safeIndex];

  const start = parseISO(draft.startDate);
  const end = parseISO(draft.endDate);
  const untilStart = differenceInCalendarDays(start, startOfDay(new Date()));
  const timing =
    untilStart > 0
      ? t('tripDetail.notebook.countdown', { count: untilStart })
      : untilStart === 0
        ? t('tripDetail.notebook.departsToday')
        : startOfDay(new Date()) > end
          ? t('tripDetail.notebook.ended')
          : t('tripDetail.notebook.traveling', { n: -untilStart + 1 });
  const color = tripColor(trip.title);

  function describeDates(startDate: string, endDate: string) {
    const { lost, note } = planDateChange(draft, days, startDate, endDate);
    if (!note) return null;
    return {
      warn: note === 'lost',
      text: t(`tripDetail.dates.${note}`, { days: lost.join(', '), count: lost.length }),
    };
  }

  function applyDates(startDate: string, endDate: string, offset: number) {
    update(
      (d) => ({
        ...d,
        startDate,
        endDate,
        activities: shiftDailyPlans(t, d.activities, startDate, endDate, offset),
      }),
      { dayShift: offset },
    );
    const length = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    setDayIndex((i) => Math.min(Math.max(i - offset, 0), length - 1));
    setDatesOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function saveDates(startDate: string, endDate: string) {
    const { offset, lost } = planDateChange(draft, days, startDate, endDate);
    if (!lost.length) return applyDates(startDate, endDate, offset);
    Alert.alert(
      t('tripDetail.dates.confirmTitle'),
      t('tripDetail.dates.lost', { days: lost.join(', '), count: lost.length }),
      [
        { text: t('tripDetail.dates.cancel'), style: 'cancel' },
        {
          text: t('tripDetail.dates.confirm'),
          style: 'destructive',
          onPress: () => applyDates(startDate, endDate, offset),
        },
      ],
    );
  }

  const dateText = `${formatDate(start, 'd. MMM')} – ${formatDate(end, 'd. MMM yyyy')}`;

  const packing = draft.packingList;
  const packedCount = packing.filter((i) => i.checked).length;
  const documents = draft.documents;

  // ── Balení a odkazy ──────────────────────────────────────
  // Smazání bez potvrzení, s „Vrátit“ v toastu (jako výlety). Vrátí položku na původní místo.
  function removeWithUndo<K extends 'packingList' | 'documents'>(key: K, id: string, message: string) {
    const list = draft[key] as { id?: string }[];
    const index = list.findIndex((x) => x.id === id);
    if (index === -1) return;
    const removed = list[index];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update((d) => ({ ...d, [key]: (d[key] as { id?: string }[]).filter((x) => x.id !== id) }));
    toast.showUndo(message, () =>
      update((d) => {
        const next = [...(d[key] as { id?: string }[])];
        next.splice(Math.min(index, next.length), 0, removed);
        return { ...d, [key]: next };
      }),
    );
  }

  const welcomeTasks: WelcomeTask[] | null =
    welcome && !readOnly
      ? [
          {
            id: 'created',
            label: t(welcome.source === 'copy' ? 'onboarding.checklist.copied' : 'onboarding.checklist.created'),
            done: true,
          },
          // Předvyplněné balení se odškrtává, prázdné se teprve píše.
          welcome.prefilledPacking === false
            ? {
                id: 'packing',
                label: t('onboarding.checklist.packingOwn'),
                done: packing.length > 0,
                onPress: () => setView('packing'),
              }
            : {
                id: 'packing',
                label: t('onboarding.checklist.packing'),
                done: packing.some((i) => i.checked),
                onPress: () => setView('packing'),
              },
          {
            id: 'plan',
            label: t('onboarding.checklist.plan'),
            done: days.some((d) => d.plan?.trim()),
            onPress: () => {
              setView('program');
              setDayIndex(0);
            },
          },
          // „Pozvi parťáky“ přibude se sdílením (fáze 6).
        ]
      : null;

  // ── PDF ──────────────────────────────────────────────────
  const availability = pdfAvailability(trip, draft);
  const totalSpent = trip.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pdfCounts = {
    itinerary: t('tripDetail.notebook.days', { count: days.length }),
    packing: `${packedCount}/${packing.length} ${t('tripDetail.mobile.items')}`,
    documents: `${documents.length} ${t('tripDetail.mobile.records')}`,
    budget: totalSpent > 0 ? formatMoney(totalSpent, trip.currency || 'CZK') : t('tripDetail.mobile.budgetEmpty'),
  };

  async function generatePdf(sections: PdfSections) {
    setPdfBusy(true);
    try {
      // Sheet nejdřív zavřít, sdílení iOS se přes něj neotevře.
      setPdfOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 280));
      await exportTripPdf(t, trip, draft, sections, user?.id);
    } catch (err) {
      if (!(err instanceof ApiError)) reportError(err);
      toast.show({ message: t('app.tripDetail.pdfError') });
    } finally {
      setPdfBusy(false);
    }
  }

  const tabs: { id: View_; label: string; count?: string }[] = [
    { id: 'program', label: t('tripDetail.notebook.program') },
    {
      id: 'packing',
      label: t('tripDetail.notebook.packing'),
      count: packing.length ? `${packedCount}/${packing.length}` : undefined,
    },
    {
      id: 'documents',
      label: t('tripDetail.notebook.links'),
      count: documents.length ? String(documents.length) : undefined,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          // Přepínač Program · Balení · Odkazy uprostřed lišty (jako Kalendář na iOS).
          headerTitle: () => <ViewSwitcher tabs={tabs} active={view} onChange={setView} />,
          // Další akce výletu v nativním menu (PDF, web).
          headerRight: () => (
            <MenuView
              actions={[
                {
                  id: 'pdf',
                  title: t('tripDetail.exportPdf'),
                  image: 'arrow.down.document',
                },
                { id: 'web', title: t('app.tripDetail.openWeb'), image: 'safari' },
              ]}
              onPressAction={({ nativeEvent }) => {
                if (nativeEvent.event === 'pdf') openSheet(() => setPdfOpen(true));
                if (nativeEvent.event === 'web') {
                  WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/trip/${trip.id}`);
                }
              }}>
              <View style={styles.menuButton} accessibilityLabel={t('app.tripDetail.more')}>
                <SymbolView
                  name={{ ios: 'ellipsis', android: 'more_horiz' }}
                  size={22}
                  tintColor={Colors.primary}
                />
              </View>
            </MenuView>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={typing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: Spacing.eight },
        ]}>
        <View style={styles.header}>
          {readOnly ? (
            <Text style={styles.title}>{draft.title}</Text>
          ) : (
            <Pressable
              onPress={() => openSheet(() => setTitleOpen(true))}
              accessibilityRole="button"
              accessibilityLabel={`${t('tripDetail.rename')}: ${draft.title}`}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.title}>
                {draft.title}
                <Text style={styles.titlePencil}>
                  {'  '}
                  <SymbolView
                    name={{ ios: 'pencil', android: 'edit' }}
                    size={18}
                    weight="semibold"
                    tintColor={Colors.textTertiary}
                  />
                </Text>
              </Text>
            </Pressable>
          )}

          {trip.isSample && (
            <View style={[styles.badge, { backgroundColor: color.bg }]}>
              <Text style={[styles.badgeText, { color: color.fg }]}>{t('guest.sample.badge')}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            {readOnly ? (
              <Text style={styles.metaStrong}>{dateText}</Text>
            ) : (
              <Pressable
                onPress={() => openSheet(() => setDatesOpen(true))}
                accessibilityLabel={`${t('tripDetail.dates.edit')}: ${dateText}`}
                style={({ pressed }) => [styles.datesButton, pressed && styles.pressed]}>
                <Text style={styles.metaStrong}>{dateText}</Text>
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit' }}
                  size={13}
                  weight="semibold"
                  tintColor={Colors.textTertiary}
                />
              </Pressable>
            )}
            <Text style={styles.meta}>
              · {t('tripDetail.notebook.days', { count: days.length })} · {timing}
            </Text>
          </View>

          {(trip.role !== 'owner' || saveState !== 'idle') && (
            <View style={styles.metaRow}>
              {trip.role !== 'owner' && (
                <View style={[styles.roleBadge, readOnly ? styles.roleViewer : styles.roleEditor]}>
                  <SymbolView
                    name={
                      readOnly
                        ? { ios: 'eye', android: 'visibility' }
                        : { ios: 'pencil', android: 'edit' }
                    }
                    size={11}
                    weight="semibold"
                    tintColor={readOnly ? Colors.textSecondary : Colors.primary}
                  />
                  <Text style={[styles.roleText, !readOnly && styles.roleTextEditor]}>
                    {t(`tripDetail.roles.${trip.role}`)}
                  </Text>
                </View>
              )}
              {!readOnly && <SaveStatus state={saveState} onRetry={retry} />}
            </View>
          )}

          {readOnly && (
            <View style={styles.viewerBanner}>
              <SymbolView
                name={{ ios: 'eye', android: 'visibility' }}
                size={15}
                tintColor={Colors.textSecondary}
              />
              <Text style={styles.viewerText}>{t('tripDetail.viewerBanner')}</Text>
            </View>
          )}
        </View>

        {welcomeTasks && (
          <View style={styles.pageWrap}>
            <WelcomeChecklist
              title={t(
                welcome?.source === 'copy'
                  ? 'onboarding.checklist.titleCopy'
                  : 'onboarding.checklist.title',
              )}
              tasks={welcomeTasks}
              onDismiss={dismissWelcome}
            />
          </View>
        )}

        {view === 'program' && (
          <>
            <DayStrip days={days} activeIndex={safeIndex} onSelect={setDayIndex} />
            {day && (
              <View style={styles.pageWrap}>
                <DayPage
                  key={safeIndex}
                  day={day}
                  index={safeIndex}
                  days={days}
                  readOnly={readOnly}
                  onChange={(patch) =>
                    update((d) => ({
                      ...d,
                      activities: d.activities.map((a, i) => (i === safeIndex ? { ...a, ...patch } : a)),
                    }))
                  }
                  onNavigate={(i) => i >= 0 && i < days.length && setDayIndex(i)}
                  onFocusInput={() => setTyping(true)}
                />
              </View>
            )}
          </>
        )}

        {view === 'packing' && (
          <View style={styles.pageWrap}>
            <PackingList
              items={packing}
              readOnly={readOnly}
              onFocusInput={() => setTyping(true)}
              onAdd={(text) =>
                update((d) => ({
                  ...d,
                  packingList: [...d.packingList, { id: localId(), text, checked: false }],
                }))
              }
              onToggle={(id) =>
                update((d) => ({
                  ...d,
                  packingList: d.packingList.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
                }))
              }
              onDelete={(id) => removeWithUndo('packingList', id, t('app.tripDetail.itemDeleted'))}
            />
          </View>
        )}

        {view === 'documents' && (
          <View style={styles.pageWrap}>
            <NotesList
              documents={documents}
              readOnly={readOnly}
              onAdd={(title, content) =>
                update((d) => ({
                  ...d,
                  documents: [...d.documents, { id: localId(), title, content }],
                }))
              }
              onUpdate={(id, title, content) =>
                update((d) => ({
                  ...d,
                  documents: d.documents.map((doc) => (doc.id === id ? { ...doc, title, content } : doc)),
                }))
              }
              onDelete={(id) => removeWithUndo('documents', id, t('app.tripDetail.docDeleted'))}
            />
          </View>
        )}
      </ScrollView>

      <PdfSheet
        visible={pdfOpen}
        availability={availability}
        counts={pdfCounts}
        busy={pdfBusy}
        onGenerate={generatePdf}
        onClose={() => setPdfOpen(false)}
      />
      <TitleSheet
        visible={titleOpen}
        title={draft.title}
        onSave={(title) => {
          update((d) => ({ ...d, title }));
          setTitleOpen(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onClose={() => setTitleOpen(false)}
      />
      <DatesSheet
        visible={datesOpen}
        startDate={draft.startDate}
        endDate={draft.endDate}
        describe={describeDates}
        onSave={saveDates}
        onClose={() => setDatesOpen(false)}
      />
    </>
  );
}

// Nativní segmenty iOS v navigační liště (SwiftUI Picker): výběr jde přetáhnout prstem
// a na iOS 26 má systémový vzhled skla. Počty jsou jen v popisku pro čtečku.
function ViewSwitcher({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: View_; label: string; count?: string }[];
  active: View_;
  onChange: (view: View_) => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      values={tabs.map((tab) => tab.label)}
      selectedIndex={tabs.findIndex((tab) => tab.id === active)}
      onChange={({ nativeEvent }) => {
        const next = tabs[nativeEvent.selectedSegmentIndex];
        if (!next || next.id === active) return;
        Haptics.selectionAsync();
        onChange(next.id);
      }}
      accessibilityLabel={t('tripDetail.tabs.tools')}
      style={styles.segmented}
    />
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { t } = useTranslation();
  if (state === 'idle') return null;
  if (state === 'error') {
    return (
      <Pressable onPress={onRetry} hitSlop={8} style={styles.saveStatus}>
        <SymbolView
          name={{ ios: 'exclamationmark.circle.fill', android: 'error' }}
          size={14}
          tintColor={Colors.danger}
        />
        <Text style={[styles.saveText, styles.saveError]}>{t('tripDetail.notebook.saveError')}</Text>
      </Pressable>
    );
  }
  const busy = state === 'pending' || state === 'saving';
  return (
    <View style={styles.saveStatus} accessibilityLiveRegion="polite">
      {busy ? (
        <ActivityIndicator size="small" color={Colors.textTertiary} style={styles.saveSpinner} />
      ) : (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check' }}
          size={13}
          weight="bold"
          tintColor={Colors.success}
        />
      )}
      <Text style={styles.saveText}>
        {busy ? t('tripDetail.notebook.saving') : t('tripDetail.notebook.saved')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.four },
  header: { gap: Spacing.two, paddingHorizontal: Spacing.five },
  title: { fontSize: 30, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  titlePencil: { fontSize: 18 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  datesButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  metaStrong: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 15, color: Colors.textSecondary },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  roleViewer: { backgroundColor: Colors.separator },
  roleEditor: { backgroundColor: Colors.primarySoft },
  roleText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  roleTextEditor: { color: Colors.primary },
  viewerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Colors.separator,
  },
  viewerText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  saveSpinner: { transform: [{ scale: 0.7 }] },
  saveText: { fontSize: 13, color: Colors.textSecondary },
  saveError: { color: Colors.danger, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  stripSkeleton: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginVertical: Spacing.four,
  },
  pageWrap: { paddingHorizontal: Spacing.four },
  menuButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  // Šířka pro tři krátké popisky; nativní segmenty si samy nastaví jen výšku.
  segmented: { width: 252 },
});
