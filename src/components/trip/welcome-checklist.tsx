import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type WelcomeTask = { id: string; label: string; done: boolean; onPress?: () => void };

// První kroky v novém výletu (WelcomeChecklist na webu). Úkoly se odškrtávají samy
// podle toho, co uživatel v detailu udělá; když je hotovo vše, zůstane krátká pochvala.
export function WelcomeChecklist({
  title,
  tasks,
  onDismiss,
}: {
  title: string;
  tasks: WelcomeTask[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const done = tasks.filter((task) => task.done).length;
  const allDone = done === tasks.length;

  return (
    <View style={styles.card} accessibilityLabel={title}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>{allDone ? t('onboarding.checklist.doneTitle') : title}</Text>
          <Text style={styles.sub}>
            {allDone
              ? t('onboarding.checklist.doneSubtitle')
              : t('onboarding.checklist.progress', { done, total: tasks.length })}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close' }}
            size={13}
            weight="bold"
            tintColor={Colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(done / tasks.length) * 100}%` }]} />
      </View>

      {!allDone && (
        <View style={styles.tasks}>
          {tasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => {
                Haptics.selectionAsync();
                task.onPress?.();
              }}
              disabled={task.done || !task.onPress}
              accessibilityState={{ checked: task.done }}
              style={({ pressed }) => [styles.task, task.done && styles.taskDone, pressed && styles.pressed]}>
              <View style={[styles.dot, task.done && styles.dotDone]}>
                {task.done && (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check' }}
                    size={11}
                    weight="bold"
                    tintColor="#fff"
                  />
                )}
              </View>
              <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.label}</Text>
              {!task.done && (
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right' }}
                  size={12}
                  weight="semibold"
                  tintColor={Colors.textTertiary}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.separator, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
  tasks: { gap: Spacing.two },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  taskDone: { backgroundColor: Colors.background, borderColor: 'transparent' },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  taskText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  taskTextDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },
});
