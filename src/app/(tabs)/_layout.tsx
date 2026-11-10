import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <NativeTabs tintColor={Colors.primary}>
      <NativeTabs.Trigger name="(prehled)">
        <NativeTabs.Trigger.Label>{t('app.tabs.overview')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(vylety)">
        <NativeTabs.Trigger.Label>{t('app.tabs.trips')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'suitcase', selected: 'suitcase.fill' }}
          md="luggage"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(mapa)">
        <NativeTabs.Trigger.Label>{t('app.tabs.map')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(profil)">
        <NativeTabs.Trigger.Label>{t('app.tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
