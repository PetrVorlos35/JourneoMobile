---
name: faze
description: Orchestrator for Journeo Mobile development. Use when Petr asks to build a roadmap phase or part of one ("udělej fázi 4", "pokračuj fází 5", "/faze 4b", "jdeme na mapu"), or to process his test results for a phase ("otestováno, chyby jsou v obsidianu"). Runs the agent pipeline web-parity → rozhodnutí → rn-builder → verifier → rn-reviewer → test-writer and keeps the roadmap in Obsidian up to date.
argument-hint: "<číslo fáze nebo část, např. 4 / 4b / test 4a>"
---

# Orchestrátor fáze – Journeo Mobile

Petr napíše jen co chce („udělej fázi 4“). Ty řídíš agenty v `.claude/agents/` a sám děláš jen koordinaci, rozhodnutí, slučování a závěrečné shrnutí. Pravidla projektu jsou v `CLAUDE.md` – platí pro tebe i agenty.

Cesty:
- Roadmapa: `~/Documents/Obsidian Vault/Claude/Projekty/Journeo/Journeo – mobilní roadmapa.md`
- Plán fáze (píšeš ty): `…/Projekty/Journeo/Journeo – fáze <N> plán.md`
- Ruční testy (píše test-writer): `…/Projekty/Journeo/Journeo – mobil test fáze <X>.md`

Průběžně dávej Petrovi krátké zprávy, co se děje (1 věta: „Agenti zkoumají web…“, „Stavím 4a a 4b paralelně…“).

## Režim A: nová fáze nebo její část

### 1. Příprava
- Přečti roadmapu (sekci fáze + „Postup“ a rozhodnutí), plán fáze, pokud už existuje, a `git status --short`.
- **Necommitnuté změny z minulé fáze**: řekni to Petrovi jednou větou a nabídni, že počkáš na commit. Paralelní worktree vycházejí z commitu, takže bez commitu jedeš sekvenčně v hlavním stromu.
- Rozděl fázi na **kusy** (4a, 4b, …): každý = ucelená funkce testovatelná na iPhonu, 1 kus ≈ jedno sezení práce. Kusy, které nesahají na stejné soubory, označ jako nezávislé.

### 2. Rešerše (paralelně)
- Pro každý kus spusť `web-parity` (všechny najednou v jedné zprávě). V zadání uveď: název kusu, položky roadmapy, co už v mobilu je.
- Výsledky shrň do plánu fáze (Obsidian): pro každý kus cíl, API, stavy, soubory, rizika. Na plán odkaž z roadmapy.

### 3. Rozhodnutí
- Posbírej otevřená rozhodnutí ze všech specifikací. Co má zřejmou volbu, rozhodni sám a zapiš. Skutečná rozhodnutí (vzhled, chování, knihovna, nový backend) polož Petrovi **naráz** přes AskUserQuestion (max 4 otázky, doporučená volba první, u UI náhled v `preview`).
- Rozhodnutí zapiš do roadmapy s datem (sekce fáze).
- Pokud kus potřebuje **nový backend [BE]** nebo zásah do webu `~/JourneoV2`, nedělej ho bez Petrova souhlasu.

### 4. Stavba
- **Malý nebo provázaný kus**: postav sám v hlavním stromu (stejná pravidla jako rn-builder).
- **Nezávislé kusy a čistý commit**: `rn-builder` s `isolation: "worktree"`, paralelně. Každému dej: spec, rozhodnutí, přesný rozsah souborů, co nesmí měnit. Pak změny přenes do hlavního stromu (`git -C <worktree> diff HEAD` + nové soubory → `git apply`), konflikty ve sdílených souborech (`api.ts`, locales) slouč ručně.
- Hook po každé úpravě hlídá typecheck a lint – chyby opravuj hned.

### 5. Ověření a recenze (smyčka)
1. `verifier` → dokud něco ❌, oprav (max 3 kola, pak to přiznej Petrovi).
2. `rn-reviewer` na celý diff kusu. Zjištění ověř v kódu; opravuj vysoká a střední, nízká jen když jsou levná. Co neopravíš, napiš proč.
3. Znovu `verifier`.

### 6. Testy a dokumentace
- `test-writer` (unit testy + ruční checklist do Obsidianu).
- Roadmapa: odškrtni hotové položky, k fázi připiš stav („hotové YYYY-MM-DD, neověřeno na iPhonu, necommit“), nové soubory a rozhodnutí.
- Memory `journeo_project.md` + řádek v `MEMORY.md`, řádek do `Meta/Historie konverzací.md`.

### 7. Předání Petrovi
Krátce česky: co umí (body), co je jinak než web a proč, co bylo vynecháno nebo přesunuto, výsledek kontrol (pravdivě – co prošlo, co ne), odkaz na testovací poznámku. **Nikdy necommituj**, připomeň commit.

## Režim B: Petr otestoval („mám to zkontrolované v obsidianu“)
1. Přečti testovací poznámku – neodškrtnuté body a sekci „Nalezené chyby“; screenshoty v konverzaci ber jako hlavní důkaz.
2. Pro každou chybu najdi příčinu v kódu (u nejasných spusť paralelně `Explore`/`rn-reviewer` zaměřené na konkrétní chování). Neopravuj naslepo – nejdřív příčina, pak oprava.
3. Oprav → `verifier` → zapiš do poznámky sekci „Opravy N (datum)“ s příčinou a co přetestovat → krátce Petrovi.
4. Když Petr potvrdí, že je kus v pořádku: v roadmapě „otestováno“, navrhni commit a další kus.

## Zásady
- Agentům piš úplné zadání (nemají tvůj kontext): cíl, soubory, rozhodnutí, co vrátit.
- Nezávislé agenty spouštěj v jedné zprávě, ať běží souběžně. Nečekej aktivně – výsledky přijdou samy.
- Neopakuj práci agenta (když už web-parity něco našel, nečti to znovu).
- Na iPhonu nic nevidíš: nic neprohlašuj za ověřené na zařízení.
