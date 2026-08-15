# Session log — 14–15 august 2026 (etapa curentă, mod competitiv, backup, retragere jucători)

Operare live în plin sezon (etapa 5). Model: Opus 4.8 cu fable-mindset (diagnoză înainte de fix, verificare empirică, deploy + verificat 200 după fiecare schimbare). Toate schimbările deployate manual pe Vercel (`npx vercel --prod`, user logat în CLI ca `morlocul`).

## Punct de plecare
App live la https://pornostic.vercel.app, sezon în desfășurare, 6 jucători. Ultimul log: `2026-07-22-operare-si-fixuri.md`.

## Ce s-a rezolvat / adăugat

### 1. „Nu a luat etapa de acum" — bug de logică, nu de scraper (commit `619ba69`)
Homepage rămăsese blocat pe **etapa 4**, deși etapa 5 (14–17 aug) era cea de jucat. Cauză: meciul **CFR Cluj – Universitatea Cluj** din etapa 4 e amânat real pe **8 octombrie** (confirmat din 365Scores), iar `currentRound()` alegea *cea mai mică etapă cu vreun meci scheduled* → un singur meci amânat ținea totul agățat. **Fix:** `currentRound` alege acum etapa meciului deschis cu **cel mai apropiat kickoff**. Astfel etapa 5 e curentă acum, iar în octombrie revine automat la 4 pentru meciul amânat.

### 2. Meciuri amânate ascunse de pe prima pagină + tab „Amânate" (commits `1d99afe`, `154250b`)
- `partitionRoundMatches({visible,hidden})` în `scoring.ts`: un meci separat de restul etapei printr-un salt **>7 zile** e „straggler" și e ascuns de pe homepage până cu **3 zile înainte** de disputare (`ROUND_OUTLIER_DAYS=7`, `OUTLIER_REVEAL_DAYS=3`). `visibleRoundMatches` delegă la ea.
- Pagină nouă **`/amanate`** (ultimul tab înainte de Admin): listează stragglerii ascunși, cu etapa și data. Revin automat pe homepage cu 3 zile înainte.

### 3. Scrape din 10 → **1 minut** în timpul meciurilor (commits `810042e`, `df343c4`)
Bucla self-loop din `.github/workflows/scrape.yml`: `sleep 600` → `sleep 60`. Fără risc de blocare (API 365Scores fără cheie, site-ul lor cere un meci la ~10–15s; ~6 cereri/run de la un IP = neglijabil; bucla e secvențială curl+sleep + `concurrency` = fără suprapuneri). 1 min e pragul optim — sub el nu se câștigă nimic perceptibil. Aplicat imediat via `gh workflow run` (nu așteptăm trigger-ul rar GitHub).

### 4. Mod competitiv — scoruri ascunse până la kickoff, dar se vede cine a pus (commit `40e2242`)
`SHOW_ALL_PREDICTIONS=false`. `hasStarted(kickoff)` nou (`now >= kickoff`) dezvăluie scorurile celorlalți **fix la fluierul de start** (nu la blocarea de editare de 1 min). Până atunci fiecare meci arată doar prezența: `✓ a pus` vs `⏳ n-a pus încă` (roster complet fetch-uit pe homepage + `/etapa/[round]`), ca să vă anunțați cine a uitat. Pronosticul propriu mereu vizibil. Export-ul Excel a fost și el mutat `isLocked`→`hasStarted`, ca fișierul descărcat să nu scurgă pronosticurile nedezvăluite.

### 5. Retragere jucător care a renunțat — soft, păstrează istoricul (commit `5f676dc`)
Coloană nouă `players.active` (default true, adăugată în DB via Management API + documentată în `schema.sql`). Admin → Jucători → **„Scoate din joc"** (reversibil „Reactivează"). Retrasul: păstrează punctele/clasamentele din etapele jucate; iese din lista de prezență („cine n-a pus"); blocat la login și la pus pronosticuri; în clasament apare doar unde chiar a punctat. Adminul nu se poate retrage pe sine. Userul a ales explicit varianta soft (nu ștergere) ca să nu strice clasamentele trecute.

### 6. Backup local săptămânal al DB (commit `154250b`)
`npm run backup` (`scripts/backup-db.mjs`): snapshot complet al fiecărui tabel în `./backups/pornostic-<data>/*.json` — backup real, restaurabil (paginare 1000/req). Gitignorat (conține hash-uri PIN; repo public). Automatizat via Windows Task Scheduler: task **„Pornostic DB Backup"** (rulează `scripts/backup.bat`, duminică 12:00, `StartWhenAvailable` = rulează și mai târziu dacă PC-ul era oprit). **Task-ul e pe mașina userului, NU în repo.** Prima rulare verificată: 6 jucători / 192 meciuri / 171 pronosticuri / 1892 scrape_runs.

### 7. Analiză etapa 5 (conversațional, fără cod)
Din rezultatele reale ale etapelor 1–4: clasament + profil acasă/deplasare per echipă, favoriți și scoruri probabile pe fiecare meci din etapa 5. Cei mai siguri: FCSB, U Cluj, FC Argeș (acasă vs adversari slabi în deplasare). Loz în plic: Rapid–Dinamo, Oțelul–Craiova.

## Evaluare cerută anterior
`dondai1234/master-fetch` (= „Hound", MCP de web-fetch cu bypass Cloudflare): **nu ajută scraperul** — rezolvă ziduri anti-bot pe care le ocolim deja cu JSON-ul curat de la 365Scores; e greu (Chromium) și nepotrivit pentru serverless. Rămâne arhitectura actuală.

## Stare la 2026-08-15
- Etapa 5 în desfășurare (14–17 aug). Scrape la 1 min în timpul meciurilor.
- 79 teste verzi. Working tree curat, tot deployat.
- Config cheie: `SHOW_ALL_PREDICTIONS=false`, `LOCK_MINUTES=1`, `ROUND_OUTLIER_DAYS=7`, `OUTLIER_REVEAL_DAYS=3`.

## Context pentru RELUARE (resume)
- **Live:** https://pornostic.vercel.app · **Repo:** github.com/morlocul/pornostic (PUBLIC) · **Supabase ref:** wbhlbfptjqzjxubioxuq · **Vercel project:** pornostic (team straniu).
- **Deploy:** `npx vercel --prod --yes` (user logat în CLI ca `morlocul` — merge fără token). Auto-deploy GitHub NU e conectat.
- **Operare DB:** Supabase Management API cu token `sbp_...` (încă valid la 14 aug — dacă e revocat, cere altul). Endpoint SQL: `POST https://api.supabase.com/v1/projects/<ref>/database/query`.
- **CI scrape:** `.github/workflows/scrape.yml` self-loop 1 min ~6h, 2 declanșări/zi (12:00 + 18:00 UTC) + `concurrency`. Aplicare imediată: `gh workflow run scrape.yml`.
- **Backup:** `npm run backup` local; task Windows „Pornostic DB Backup" (duminică 12:00). Backup-urile în `./backups/` (gitignored).
- **Gotcha tz:** sandbox fără tzdata → `date` arată UTC; RO = UTC+3 vara.
- Reluare: `claude --resume` în `G:\PRONOSTIC APP`.
