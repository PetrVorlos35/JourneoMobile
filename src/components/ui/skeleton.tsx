import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

// Šedý blok místo obsahu, který se načítá. Tvarem má odpovídat skutečnému obsahu.
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius }, animated, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// Řádek seznamu: ikona + dva řádky textu. Nejčastější tvar v appce.
export function SkeletonRow({ divider }: { divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Skeleton width={40} height={40} radius={Radius.small} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={15} />
        <Skeleton width="35%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} divider={i > 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.separator, borderCurve: 'continuous' },
  list: {
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  rowText: { flex: 1, gap: Spacing.two },
});
