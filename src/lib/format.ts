import { format as formatFns } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';

import { currentLanguage } from '@/lib/i18n';

const dateLocale = () => (currentLanguage() === 'cs' ? cs : enUS);
const intlLocale = () => (currentLanguage() === 'cs' ? 'cs-CZ' : 'en-GB');

// Vzory date-fns, např. 'd. M.' nebo 'EEEE d. MMMM'.
export const formatDate = (date: Date | string | number, pattern: string) =>
  formatFns(new Date(date), pattern, { locale: dateLocale() });

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
