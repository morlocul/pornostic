# Session log — 17 iulie 2026 (prima etapă, tracking live)

Prima zi de campionat. Aplicația a trecut de la „ar trebui să meargă" la „verificat pe date reale, minut cu minut". Orchestrare: Opus 4.8 (execuție, cu fable-mindset) sub coordonare; controlul live făcut direct din sesiune.

## Punct de plecare
Aplicația era deja live (vezi `2026-07-16.md`): pronosticuri, clasament total + pe luni, marcatori, logo-uri, profil, export Excel, scraper 365Scores. 6 jucători înscriși cu pronosticuri pe Etapa 1.

## Ce s-a întâmplat azi

1. **Primul meci (Voluntari 2–2 Botoșani)** — la verificarea rezultatului am descoperit o gaură reală: 365Scores are o **fereastră de tranziție** (meciul terminat dispare din `/fixtures/` înainte să apară în `/results/`), deci scorul final întârzia. L-am confirmat manual, punctele au ieșit corect (3 jucători câte 1p pe egal).
2. **Fix: „măturătorul de meciuri restante"** (`8021324`) — pentru meciurile care ar fi trebuit să se termine, scraperul interoghează direct pagina meciului (`/web/game/?gameId=`), nu doar listele. Best-effort, max câteva pe rulare, nu poate strica o rulare.
3. **Cadență cron mai deasă** (`a4b0bb0`) — GitHub Actions: la 30 min ziua (13:00–19:30 RO) + **la 10 min seara** (20:00–00:50 RO), fereastra în care se termină meciurile.
4. **Modul LIVE** (`d5c855f`) — cererea userului: scor + marcatori la 10 min **pe tot parcursul meciului**. Adăugat status `'live'`, `live_minute`, badge roșu pulsatoriu cu minutul, scor și marcatori în timp real. Sweep pe fereastra meciului (kickoff între now−150min și now); `upsertMatches` protejează meciurile live să nu fie retrogradate la „scheduled" de liste; `currentRound` tratează `'live'` ca etapă deschisă.

## Verificare pe date reale — FCSB 2–0 Argeș
Watcher local la 10 min a urmărit tot meciul. Log real:
```
21:41 live 0-0 (8')  →  22:01 live 1-0 (28')  →  22:22 live 1-0 (45+3')
22:32 live 2-0 (45') →  23:22 live 2-0 (86')  →  23:32 finished 2-0
```
- Marcatori capturați automat: 18' Bîrligea, 45' Tănase (penalty).
- Puncte (hand-traced, toate corecte): Tudor Hitler 2–0 → 2p (scor exact); VRM/Dan/Siclovan (2–1) + ClauCode (1–0) → 1p; Mișu (1–1) → 0p.
- **Concluzie: tot lanțul funcționează fără intervenție** — live → finalizat → recalculare → clasament.

## Stare finală
- **66/66 teste** verzi · build curat · toate schimbările deployate pe producție
- Clasament după 2 meciuri: Tudor Hitler 2p (1 exact, lider pe departajare), Dan/VRM/ClauCode 2p, Siclovan 1p, Mișu 0p
- Singura ciudățenie: display-ul minutului 365Scores poate arăta scurt „45'" în jurul pauzei — pur cosmetic, scorul/golurile mereu corecte

## De reținut
- 365Scores = cea mai ușor de scrape sursă testată (JSON, fără cheie, merge de pe datacenter/Vercel; Sofascore 403, Flashscore semnături). Risc: neoficială, se poate schimba → plasa = teste pe fixtures + cascadă + manual.
- Watcher-e locale în `/tmp` (live-watcher.sh) pentru serile speciale când vrei 10-min garantat; altfel GitHub Actions acoperă seara.
- Deploy Vercel tot manual (`npx vercel --prod`).
