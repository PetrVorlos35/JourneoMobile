import { parseISO } from 'date-fns';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';

import { tripsApi, type Trip, type TripBalances, type TripMember } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { TripDraft } from '@/lib/trip-editor';
import { reportError, track } from '@/lib/telemetry';

// PDF výletu jako TripPdfExport na webu: hero, itinerář, balení, odkazy, rozpočet.
// HTML se vytiskne do souboru (expo-print) a nabídne se přes systémové sdílení.

export const PDF_SECTIONS = ['itinerary', 'packing', 'documents', 'budget'] as const;
export type PdfSection = (typeof PDF_SECTIONS)[number];
export type PdfSections = Record<PdfSection, boolean>;

type Category = 'transport' | 'accommodation' | 'food' | 'activities' | 'other';

const CATEGORY_COLORS: Record<Category, string> = {
  transport: '#3b82f6',
  accommodation: '#a855f7',
  food: '#f97316',
  activities: '#10b981',
  other: '#6b7280',
};

// A4 v bodech (72 dpi).
const A4 = { width: 595, height: 842 };

const asCategory = (id: string | undefined): Category =>
  id && id in CATEGORY_COLORS ? (id as Category) : 'other';

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

// Co jde do PDF vůbec nabídnout (prázdné části se neukazují, jako na webu).
export function pdfAvailability(trip: Trip, draft: TripDraft): PdfSections {
  return {
    itinerary: draft.activities.length > 0,
    packing: draft.packingList.length > 0,
    documents: draft.documents.length > 0,
    budget: trip.expenses.length > 0 || !!trip.budgetTarget,
  };
}

const memberName = (m: TripMember | undefined) =>
  m ? [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email : '—';

function buildHtml(
  t: TFunction,
  trip: Trip,
  draft: TripDraft,
  sections: PdfSections,
  balances: TripBalances | null,
  userId: number | undefined,
) {
  const currency = trip.currency || 'CZK';
  const money = (amount: number) => formatMoney(amount ?? 0, currency);
  const day = (iso: string, pattern: string) => formatDate(parseISO(iso), pattern);

  const days = draft.activities;
  const packing = draft.packingList;
  const docs = draft.documents;
  const expenses = [...trip.expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const target = trip.budgetTarget || 0;

  const show = {
    itinerary: sections.itinerary && days.length > 0,
    packing: sections.packing && packing.length > 0,
    documents: sections.documents && docs.length > 0,
    budget: sections.budget && (expenses.length > 0 || target > 0),
  };
  const stops = [...new Set(days.map((d) => d.location?.trim()).filter(Boolean))];
  const packed = packing.filter((i) => i.checked).length;

  const members = balances?.members ?? [];
  const label = (id: number) =>
    Number(id) === Number(userId)
      ? t('budget.balances.you')
      : memberName(members.find((m) => Number(m.id) === Number(id)));
  const showPaidBy = members.length > 1;
  const hasShared = expenses.some((e) => (e.splits ?? []).length > 0);
  const showBalances = members.length > 1 && hasShared && (balances?.balances.length ?? 0) > 0;

  const categoryLabel = (id: string | undefined) => t(`budget.categories.${asCategory(id)}`);
  const byCategory = (Object.keys(CATEGORY_COLORS) as Category[])
    .map((id) => {
      const list = expenses.filter((e) => asCategory(e.category) === id);
      return { id, count: list.length, amount: list.reduce((s, e) => s + (Number(e.amount) || 0), 0) };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.amount - a.amount);

  let num = 0;
  const head = (title: string) =>
    `<div class="section-head"><span class="num">${String(++num).padStart(2, '0')}</span><h2>${esc(title)}</h2><span class="line"></span></div>`;

  const itinerary = show.itinerary
    ? `<section>${head(t('pdf.itinerary'))}${days
        .map(
          (d, i) => `<div class="day">
            <div class="rail"><span class="day-num">${i + 1}</span><span class="dow">${esc(day(d.date, 'EEE'))}</span></div>
            <div class="day-body">
              <div class="day-head"><span class="day-title">${esc(d.title)}</span><span class="day-date">${esc(day(d.date, 'd. M. yyyy'))}</span></div>
              ${d.location ? `<p class="loc">📍 ${esc(d.location)}</p>` : ''}
              ${d.plan ? `<p class="plan">${esc(d.plan)}</p>` : `<p class="plan muted-italic">${esc(t('pdf.emptyDay'))}</p>`}
            </div>
          </div>`,
        )
        .join('')}</section>`
    : '';

  const packingHtml = show.packing
    ? `<section>${head(t('pdf.packing'))}
        <p class="subnote">${esc(t('pdf.packed', { done: packed, total: packing.length }))}</p>
        <div class="pack-grid">${packing
          .map(
            (i) =>
              `<div class="pack-item"><span class="box${i.checked ? ' checked' : ''}">${i.checked ? '✓' : ''}</span><span class="${i.checked ? 'done' : ''}">${esc(i.text)}</span></div>`,
          )
          .join('')}</div></section>`
    : '';

  const documentsHtml = show.documents
    ? `<section>${head(t('pdf.documents'))}${docs
        .map(
          (d) =>
            `<div class="doc"><p class="doc-title">${esc(d.title)}</p>${
              isUrl(d.content)
                ? `<p class="doc-url">${esc(d.content)}</p>`
                : `<p class="doc-note">${esc(d.content)}</p>`
            }</div>`,
        )
        .join('')}</section>`
    : '';

  const budgetHtml = show.budget
    ? `<section>${head(t('pdf.budget'))}
        <div class="budget-summary">
          <p class="label">${esc(t('pdf.spent'))}</p>
          <p class="budget-total">${esc(money(total))}</p>
          ${target > 0 ? `<p class="budget-target">${esc(t('pdf.target', { amount: money(target) }))}</p>` : ''}
          ${
            target > 0
              ? `<div class="progress${total > target ? ' over' : ''}"><div class="fill" style="width:${Math.min((total / target) * 100, 100)}%">${byCategory
                  .map((c) => `<span style="flex-grow:${c.amount};background:${CATEGORY_COLORS[c.id]}"></span>`)
                  .join('')}</div></div>`
              : ''
          }
        </div>
        ${
          byCategory.length
            ? `<div class="cats">${byCategory
                .map(
                  (c) =>
                    `<div class="cat"><span class="dot" style="background:${CATEGORY_COLORS[c.id]}"></span><span class="strong">${esc(categoryLabel(c.id))}</span><span class="count">×${c.count}</span><span class="amount">${esc(money(c.amount))}</span></div>`,
                )
                .join('')}</div>`
            : ''
        }
        ${
          expenses.length
            ? `<table><thead><tr><th>${esc(t('pdf.colDate'))}</th><th>${esc(t('pdf.colDescription'))}</th><th>${esc(t('pdf.colCategory'))}</th>${
                showPaidBy ? `<th>${esc(t('pdf.colPaidBy'))}</th>` : ''
              }<th class="right">${esc(t('pdf.colAmount'))}</th></tr></thead><tbody>${expenses
                .map(
                  (e) =>
                    `<tr><td class="nowrap">${e.date ? esc(day(e.date.slice(0, 10), 'd. M. yyyy')) : '—'}</td><td class="strong">${esc(e.description)}</td><td><span class="dot sm" style="background:${CATEGORY_COLORS[asCategory(e.category)]}"></span>${esc(categoryLabel(e.category))}</td>${
                      showPaidBy ? `<td>${e.paidBy ? esc(label(e.paidBy)) : '—'}</td>` : ''
                    }<td class="right strong nowrap">${esc(money(Number(e.amount)))}</td></tr>`,
                )
                .join('')}</tbody><tfoot><tr><td colspan="${showPaidBy ? 4 : 3}">${esc(t('pdf.total'))}</td><td class="right nowrap">${esc(money(total))}</td></tr></tfoot></table>`
            : ''
        }
        ${
          showBalances && balances
            ? `<p class="subhead">${esc(t('pdf.balances'))}</p>${balances.balances
                .map((b) => {
                  const settled = Math.round(b.net * 100) === 0;
                  const positive = b.net > 0;
                  return `<div class="row"><span class="strong">${esc(label(b.userId))}</span><span class="row-label">${esc(
                    settled
                      ? t('budget.balances.settledUp')
                      : positive
                        ? t('budget.balances.getsBack')
                        : t('budget.balances.owes'),
                  )}</span><span class="amount ${settled ? 'muted' : positive ? 'green' : 'red'}">${settled ? '—' : esc(money(Math.abs(b.net)))}</span></div>`;
                })
                .join('')}${
                balances.settlements.length
                  ? `<p class="subhead">${esc(t('pdf.toSettle'))}</p>${balances.settlements
                      .map(
                        (s) =>
                          `<div class="row"><span>${esc(label(s.from))}</span><span class="muted">→</span><span>${esc(label(s.to))}</span><span class="amount">${esc(money(s.amount))}</span></div>`,
                      )
                      .join('')}`
                  : ''
              }`
            : ''
        }
      </section>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 13mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, 'Helvetica Neue', sans-serif; color: #1d1d1f; font-size: 10pt; line-height: 1.55; -webkit-print-color-adjust: exact; }
    p { margin: 0; }
    .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .brand-name { font-weight: 800; font-size: 12pt; letter-spacing: -0.02em; }
    .brand-tag { margin-left: auto; font-size: 7.5pt; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.18em; }
    .hero { position: relative; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 55%, #e0e7ff 100%); border: 1px solid #dbeafe; border-radius: 20px; padding: 22px 26px 20px; margin-bottom: 24px; overflow: hidden; }
    .script { font-family: 'Snell Roundhand', 'Apple Chancery', cursive; color: #2563eb; }
    .hero .script { position: absolute; top: 14px; right: 22px; font-size: 15pt; transform: rotate(-4deg); opacity: 0.85; }
    h1 { font-size: 24pt; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin: 0 0 6px; max-width: 80%; overflow-wrap: break-word; }
    .dates { font-size: 10pt; font-weight: 600; color: #4b5563; margin-bottom: 12px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { background: rgba(255,255,255,0.75); border: 1px solid #dbeafe; border-radius: 999px; padding: 3px 12px; font-size: 8.5pt; color: #4b5563; }
    .chip strong { font-weight: 800; color: #1d1d1f; }
    .chip.blue { background: #2563eb; border-color: #2563eb; color: #dbeafe; }
    .chip.blue strong { color: #fff; }
    section { margin-bottom: 22px; }
    .section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; break-after: avoid; }
    .num { font-size: 9pt; font-weight: 800; color: #2563eb; letter-spacing: 0.05em; }
    h2 { font-size: 14pt; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
    .line { flex: 1; height: 1px; background: #e5e7eb; align-self: center; }
    .subnote { font-size: 8.5pt; font-weight: 600; color: #9ca3af; margin: -6px 0 10px; }
    .subhead { font-size: 7.5pt; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.12em; margin: 14px 0 6px; }
    .day { display: flex; gap: 14px; border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 16px; margin-bottom: 8px; break-inside: avoid; }
    .rail { display: flex; flex-direction: column; align-items: center; min-width: 34px; }
    .day-num { font-size: 16pt; font-weight: 800; color: #2563eb; line-height: 1.1; }
    .dow { font-size: 7pt; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; }
    .day-body { flex: 1; min-width: 0; }
    .day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .day-title { font-size: 11pt; font-weight: 800; }
    .day-date { font-size: 8pt; font-weight: 600; color: #2563eb; white-space: nowrap; }
    .loc { font-size: 9pt; font-weight: 700; color: #4b5563; margin-top: 2px; }
    .plan { font-size: 9.5pt; color: #374151; white-space: pre-wrap; overflow-wrap: break-word; margin-top: 4px; }
    .muted-italic { color: #9ca3af; font-style: italic; }
    .pack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
    .pack-item { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; font-size: 9.5pt; font-weight: 600; break-inside: avoid; overflow-wrap: anywhere; }
    .box { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; margin-top: 2.5px; flex-shrink: 0; border: 1.5px solid #d1d5db; border-radius: 3.5px; font-size: 7.5pt; font-weight: 800; color: #fff; line-height: 1; }
    .box.checked { background: #2563eb; border-color: #2563eb; }
    .done { color: #9ca3af; text-decoration: line-through; }
    .doc { border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px 16px; margin-bottom: 8px; break-inside: avoid; }
    .doc-title { font-size: 10pt; font-weight: 800; margin-bottom: 2px; }
    .doc-url { font-size: 8.5pt; font-weight: 600; color: #2563eb; word-break: break-all; }
    .doc-note { font-size: 9pt; color: #4b5563; white-space: pre-wrap; overflow-wrap: break-word; }
    .budget-summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; break-inside: avoid; }
    .label { font-size: 7.5pt; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.12em; }
    .budget-total { font-size: 18pt; font-weight: 800; letter-spacing: -0.02em; }
    .budget-target { font-size: 9pt; font-weight: 600; color: #6b7280; }
    .progress { height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin-top: 10px; }
    .progress .fill { height: 100%; display: flex; background: #2563eb; border-radius: 999px; overflow: hidden; }
    .progress .fill span { display: block; height: 100%; }
    .progress.over { box-shadow: inset 0 0 0 1.5px #ef4444; }
    .cats { margin-bottom: 12px; }
    .cat, .row { display: flex; align-items: center; gap: 8px; padding: 4px 2px; font-size: 9.5pt; border-bottom: 1px solid #f3f4f6; break-inside: avoid; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
    .dot.sm { width: 6px; height: 6px; margin-right: 5px; }
    .count { font-size: 8pt; font-weight: 600; color: #9ca3af; }
    .amount { margin-left: auto; font-weight: 800; font-variant-numeric: tabular-nums; }
    .row-label { font-size: 8pt; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { text-align: left; font-size: 7.5pt; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 8px 6px 0; border-bottom: 1.5px solid #e5e7eb; }
    td { padding: 5px 8px 5px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; color: #374151; }
    tr { break-inside: avoid; }
    tfoot td { border-bottom: none; border-top: 1.5px solid #e5e7eb; font-weight: 800; color: #1d1d1f; }
    .right { text-align: right; padding-right: 0; }
    .nowrap { white-space: nowrap; }
    .strong { font-weight: 700; color: #1d1d1f; }
    .muted { color: #9ca3af; }
    .green { color: #059669; }
    .red { color: #ef4444; }
    .footer { margin-top: 28px; text-align: center; }
    .footer .script { display: block; font-size: 17pt; margin-bottom: 10px; }
    .meta { display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 7.5pt; font-weight: 600; color: #9ca3af; }
  </style></head><body>
    <div class="brand"><span class="brand-name">Journeo</span><span class="brand-tag">${esc(t('pdf.travelPlan'))}</span></div>
    <div class="hero">
      <span class="script">${esc(t('pdf.signOff'))}</span>
      <h1>${esc(draft.title)}</h1>
      <p class="dates">${esc(day(draft.startDate, 'd. M. yyyy'))} — ${esc(day(draft.endDate, 'd. M. yyyy'))}</p>
      <div class="chips">
        <span class="chip"><strong>${days.length}</strong> ${esc(t('pdf.days'))}</span>
        ${show.itinerary && stops.length ? `<span class="chip"><strong>${stops.length}</strong> ${esc(t('pdf.stops'))}</span>` : ''}
        ${show.budget && (total > 0 || target > 0) ? `<span class="chip blue"><strong>${esc(money(total))}</strong>${target > 0 ? ` / ${esc(money(target))}` : ''}</span>` : ''}
      </div>
    </div>
    ${itinerary}${packingHtml}${documentsHtml}${budgetHtml}
    <div class="footer">
      <span class="script">${esc(t('pdf.signOff'))}</span>
      <div class="meta"><span>${esc(t('pdf.generatedWith'))} · journeo.vorlos.eu</span><span>${esc(t('pdf.generatedOn', { date: formatDate(new Date(), 'd. M. yyyy') }))}</span></div>
    </div>
  </body></html>`;
}

// Bezpečný název souboru z názvu výletu („Portugalsko: Lisabon“ → „Portugalsko Lisabon.pdf“).
const fileName = (title: string) =>
  `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Journeo'}.pdf`;

// Vytvoří PDF a otevře systémové sdílení (uložit do Souborů, poslat, vytisknout…).
export async function exportTripPdf(
  t: TFunction,
  trip: Trip,
  draft: TripDraft,
  sections: PdfSections,
  userId: number | undefined,
) {
  // Jména u výdajů a vyrovnání jsou volitelná; bez nich PDF vznikne taky.
  const balances = sections.budget
    ? await tripsApi.balances(trip.id).catch((err) => {
        reportError(err);
        return null;
      })
    : null;

  const html = buildHtml(t, trip, draft, sections, balances, userId);
  const { uri } = await Print.printToFileAsync({ html, ...A4 });

  // Soubor z tisku má náhodný název; při sdílení se má jmenovat podle výletu.
  let shareUri = uri;
  try {
    const target = new File(Paths.cache, fileName(draft.title));
    if (target.exists) target.delete();
    new File(uri).move(target);
    shareUri = target.uri;
  } catch (err) {
    reportError(err);
  }

  track('pdf_exported');
  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: draft.title,
  });
}
