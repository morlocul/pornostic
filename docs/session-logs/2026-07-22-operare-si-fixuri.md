# Session log — 19–22 iulie 2026 (operare live + fix-uri)

Prima săptămână de campionat: aplicația în producție cu useri reali, iar munca a fost operare + reparat probleme apărute pe date reale. Model: Opus 4.8 cu fable-mindset (diagnoză înainte de fix, verificare empirică).

## Punct de plecare
Aplicația live la https://pornostic.vercel.app (vezi log-urile 2026-07-16 și 2026-07-17). Scraper 365Scores, mod LIVE, 6 jucători.

## Ce s-a rezolvat

### 1. Meci blocat pe „live" (bug real, reparat)
Craiova–UTA a rămas înghețat „live 3–0, min 89'" timp de 16h (final real 4–0). Cauză: `sweepMatchWindow` verifica doar meciuri cu kickoff în ultimele 150 min; un meci live neprins în fereastra aia pica din filtru și nu mai era niciodată verificat. **Fix (`80213241`→`8neb...`):** meciurile `live` se urmăresc la fiecare rulare **fără limită de vârstă**, până se termină; cele `scheduled` într-o fereastră de 6h. Verificat: scrape → `finalizate: 1`, Craiova → finished 4–0, puncte recalculate.

### 2. Repo făcut public + cron fiabil
Problema de fond: **GitHub declanșează cron-ul rar și cu întârziere (~la 2h, nu orar)**, deși configul cerea des. Bucla veche acoperea doar 50 min/declanșare → găuri în care minutul îngheța.
- Repo făcut **PUBLIC** (verificat întâi că istoricul git n-are secrete — `.env.local` mereu ignorat, doar placeholdere în `.env.example`). → minute Actions nelimitate.
- **Workflow rescris:** fiecare rulare face scrape la 10 min timp de **~6 ore** (`timeout 355min`, sub plafonul de 6h al GitHub). Două declanșări/zi (12:00 + 18:00 UTC) + concurrency queue acoperă continuu ~15:00–02:50 RO. Un singur declanșator acoperă acum un bloc întreg de meciuri. `workflow_dispatch` pentru rulări manuale.

### 3. Blocare pronosticuri la 1 minut (era 1h)
La cererea userului: `LOCK_MINUTES = 1` în `src/lib/scoring.ts` (testele rescrise să urmărească valoarea din config). Vizibilitatea era deja imediată (`SHOW_ALL_PREDICTIONS=true`) — confirmat empiric pe prod: un user cu 0 pronosticuri vede deja picks-urile tuturor pe meciuri programate.

### 4. Diverse
- Setat manual pronosticul lui Dan 1–1 pe Hunedoara–Csíkszereda (la cerere).
- Confirmat: etapa merge „etapă cu etapă" — etapa 2 se deschide automat când etapa 1 nu mai are meciuri (currentRound = cea mai mică etapă cu meci scheduled/live). Userul a confirmat că vrea așa.
- Evaluat repo-ul `dondai1234/master-fetch` (= „Hound", MCP general de web-fetch cu bypass Cloudflare): **nu ajută scraperul** — rezolvă o problemă (ziduri anti-bot) pe care noi o ocolim deja cu 365Scores (JSON curat, fără zid); e greu (Chromium) și nepotrivit pentru serverless. Rămâne ce avem.

## Stare la 2026-07-22
- Etapa 1 completă. **Clasament: VRM 6p, ClauCode 6p, Dan 5p, Tudor Hitler 4p, Siclovan 3p, Mișu 3p.**
- Etapa 2 (24–27 iul) deja încărcată, devine curentă automat.
- Working tree curat, tot deployat. 66 teste verzi.

## Context pentru RELUARE (resume)
- **Live:** https://pornostic.vercel.app · **Repo:** github.com/morlocul/pornostic (PUBLIC acum) · **Supabase ref:** wbhlbfptjqzjxubioxuq · **Vercel project:** pornostic (team straniu)
- **Deploy:** manual — `npx vercel --prod --yes --token <VERCEL_TOKEN>` (userul are token; îi cere să-l dea / să-l regenereze). GitHub App Vercel NU e conectat (fără auto-deploy la push).
- **Operare DB/verificări:** prin Supabase Management API cu token `sbp_...` (userul are; i s-a spus să-l revoce — dacă e revocat, cere unul nou din supabase.com/dashboard/account/tokens).
- **Secrete în producție:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET, CRON_SECRET (în Vercel env + GitHub secret CRON_SECRET, var APP_URL). `.env.local` local, gitignored.
- **Detalii tehnice cheie:** scraper `src/scraper/` (365Scores primar → Sofascore 403/Node → TheSportsDB trunchiat → manual admin). Sweep urmărește live fără limită de vârstă. `SHOW_ALL_PREDICTIONS=true`, `LOCK_MINUTES=1`. Memoria proiectului: `~/.claude/projects/G--PRONOSTIC-APP/memory/pronosticuri-liga1-project.md`.
- **Gotcha:** sandbox-ul n-are tzdata → `TZ=Europe/Bucharest date` arată UTC; raportează pe UTC și adună +3h pentru RO.
- Reluare conversație: `claude --resume` în `G:\PRONOSTIC APP` și alege sesiunea.
