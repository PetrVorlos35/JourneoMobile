@AGENTS.md

# Journeo Mobile – pravidla projektu

Nativní appka (Expo SDK 58, Expo Router, iOS první) k webu Journeo. Web a Express API jsou v `~/JourneoV2` (server v `server/routes`, web v `src/`). Mobil mluví s **produkčním API** – každý zápis jde do skutečných dat Petrova účtu.

Kontext a stav: Obsidian `~/Documents/Obsidian Vault/Claude/Projekty/Journeo/` – hlavně `Journeo – mobilní roadmapa.md` (fáze, rozhodnutí, co je hotové) a `Journeo – mobil test fáze …` (ruční testy Petra). Vývoj fází řídí skill `/faze` (orchestrátor s agenty v `.claude/agents/`).

## Spolupráce s Petrem
- Komunikace česky, tyká se. Commity dělá Petr sám – nikdy necommitovat ani nepushovat.
- Neukončovat jeho běžící servery (Expo, Vite).
- Na iPhonu testuje Petr v Expo Go; nic neprohlašuj za „ověřené na iPhonu“, dokud to nepotvrdí.
- Nová varianta UI = rozumná volba + krátké zdůvodnění; u skutečných rozhodnutí se zeptej (AskUserQuestion, 2–4 možnosti).

## Definice „hotovo“ (každá funkce)
UI + napojení na API + skeleton při načítání (žádné točící kolečko u obsahu, spinner jen v tlačítku/stavu ukládání) + prázdný stav + chybový stav (offline vs. chyba, „Zkusit znovu“) + texty CS/EN + haptika u výběrů a mazání + read-only pro prohlížeče (`role === 'viewer'`) + typecheck, lint, testy a iOS bundle bez chyb.

## Konvence kódu
- Komentáře a texty česky, kód anglicky. Krátké komentáře „proč“, ne „co“.
- Texty: webové klíče (`src/locales/web/*.json`, sync `npm run locales:sync`, needitovat ručně) mají přednost; vlastní texty appky jen do `src/locales/{cs,en}.json` pod `app.*`, vždy obě jazyky. Klíče jsou typované – dynamické klíče zužovat na union (`as const`, `satisfies`).
- Barvy, mezery, rádiusy jen z `src/constants/theme.ts`. Světlý režim.
- Data: `useApi(key, fetcher)` (`src/lib/use-api.ts`), výlety sdílí `useTrips()` (`src/lib/trips.tsx`, `upsertTrip`, `deleteTrip`). Úpravy detailu výletu přes `useTripEditor` (`src/lib/trip-editor.ts`: autosave 800 ms, řetěz požadavků, `version` + TRIP_CONFLICT, nikdy neposílat `expenses` z detailu).
- Společné komponenty: `src/components/ui/` (Skeleton, EmptyState, ErrorState, toast `useToast().showUndo`, `BottomSheet`, `SwipeActions`). Mazání = přejetím + „Vrátit“ v toastu, bez potvrzovacího dialogu (výjimka: nevratné akce jako vysypání koše).
- Nativní prvky přednostně: `@expo/ui/community/*` (segmented-control, menu, datetime), SF Symboly přes `expo-symbols`. Vše musí běžet v **Expo Go** (žádné knihovny s vlastním nativním kódem mimo Expo Go bez dohody).
- Čistá logika patří do `src/lib/*.ts` a má testy `*.test.ts` vedle (Jest, `import { describe, expect, it } from '@jest/globals'`).
- Nová závislost jen přes `npx expo install`.

## Známé pasti (už jsme na ně narazili)
- **ScrollView s `automaticallyAdjustKeyboardInsets`** reaguje i na klávesnici ze sheetu/modalu a posune stránku → zapínat jen při psaní do vlastních polí (`typing` stav), sheety otevírat až po schování klávesnice.
- **Průhledná hlavička + otevření Modalu** = iOS přepočítá horní odsazení a obsah odskočí. Detailové obrazovky s poli a sheety mají neprůhlednou hlavičku (`headerTransparent: false`, `headerStyle` v barvě pozadí).
- **`headerLargeStyle.backgroundColor`** na iOS 26 překryje velký nadpis i vyhledávání – nepoužívat.
- **RN `Modal presentationStyle="pageSheet"`** je vždy skoro celá obrazovka → pro malé volby `BottomSheet`.
- **`useApi` při změně uživatele** musí zahodit stará data (jinak host vidí data předchozího účtu).
- **Python/sed úpravy souborů**: hledat konec bloku od jeho začátku (`index(x, start)`), jinak se trefíš do dřívějšího výskytu.
- Data výletu jsou `yyyy-MM-dd`, číst přes `parseISO` (místní čas), nikdy `new Date('yyyy-MM-dd')`.

## Ověření
`npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform ios --output-dir <scratchpad>` (bundle). Hook po každé úpravě `src/**/*.ts(x)` spouští ESLint + typecheck automaticky.
