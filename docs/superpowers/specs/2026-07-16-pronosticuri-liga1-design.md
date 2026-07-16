# Design: Pronosticuri Liga 1

**Data:** 2026-07-16
**Status:** aprobat de utilizator (conversație brainstorming)

## Scop

Aplicație web pentru un grup mic de prieteni care dau pronosticuri la meciurile din Liga 1 (SuperLiga României). Fiecare jucător pronostichează scorul exact al meciurilor; aplicația ține punctajul fiecăruia pe sezon ca să se vadă cine are dreptate cel mai des.

## Decizii stabilite

| Subiect | Decizie |
|---|---|
| Platformă | Aplicație web găzduită gratuit, accesată cu link de pe telefon/PC (iOS, Android, desktop). PWA — se poate adăuga pe home screen. |
| Date meciuri | Scraper propriu (fără API plătit) + corectare/introducere manuală din pagina de admin. |
| Punctaj | Rezultat corect (1X2): **1 punct**. Scor exact: **+1 punct bonus** (total 2 puncte). Fără pronostic = 0 puncte, fără penalizare. |
| Conturi | Nume + PIN de 4 cifre. Fără email. Sesiune persistentă pe dispozitiv (nu bagi PIN-ul la fiecare intrare). |
| Stack | Next.js (TypeScript) pe Vercel + Supabase (Postgres). Scraper rulat prin Vercel Cron. Cost: 0 lei/lună (free tiers). |

## Pagini

1. **Login / Înscriere** — alegi nume + PIN 4 cifre la înscriere; login cu aceleași. Sesiune ținută minte pe dispozitiv.
2. **Etapa curentă** (pagina principală) — meciurile etapei cu echipe, dată, oră. Pronostic = scor exact (ex. 2–1); 1X2 rezultă automat din scor. Pronosticul se **blochează la ora de start** a meciului. După start, pronosticurile tuturor devin vizibile.
3. **Clasament** — punctaj total pe sezon per jucător + detaliu pe etape.
4. **Istoric etapă** — meciuri jucate, rezultat real, pronosticul fiecăruia, punctele obținute.
5. **Admin** (doar utilizatorul principal) — corectează meciuri/rezultate, adaugă meciuri manual, declanșează recalcularea punctelor și rularea scraperului manual.

## Fluxul datelor

- **Vercel Cron** rulează scraperul de câteva ori pe zi: aduce programul etapelor viitoare și rezultatele finale ale meciurilor încheiate.
- Când intră un rezultat final (din scraper sau din admin), punctele tuturor jucătorilor se recalculează automat.
- Scraperul este un **modul izolat**, cu sursa aleasă după o cercetare dedicată (Flashscore / Sofascore / site oficial SuperLiga etc. — criteriu: stabilitate și format ușor de parsat). Dacă sursa se schimbă/moare, se înlocuiește doar modulul; aplicația continuă cu introducere manuală.
- Orice adus de scraper poate fi suprascris manual din Admin; corecturile manuale au prioritate (scraperul nu suprascrie un rezultat marcat ca fixat manual).

## Modelul de date (Supabase / Postgres)

- `players` — id, nume (unic), pin_hash, is_admin, created_at
- `rounds` — id, număr etapă, sezon, status (viitoare / în curs / încheiată)
- `matches` — id, round_id, echipa gazdă, echipa oaspete, kickoff_at, scor_final_gazde, scor_final_oaspeți, status (programat / jucat / amânat), sursă (scraper / manual), locked_manual (bool — protejat de suprascriere de către scraper)
- `predictions` — id, player_id, match_id, scor_gazde, scor_oaspeți, puncte (calculat), updated_at; unic pe (player_id, match_id)

Punctele se calculează dintr-o funcție pură `scorePrediction(predicție, rezultat)` — testabilă izolat.

## Reguli cheie

- Pronostic modificabil oricând **până la kickoff**; respins server-side după.
- PIN stocat doar ca hash.
- Autentificare prin cookie de sesiune semnat; nivelul de securitate e adecvat unui joc între prieteni, nu unei bănci.
- Admin = flag pe jucătorul principal.

## Errori și cazuri limită

- Meci amânat/anulat: statusul se schimbă, pronosticurile rămân dar nu punctează până nu se joacă.
- Scraperul eșuează: aplicația funcționează normal; adminul introduce manual. Eșecul e logat vizibil în pagina de admin.
- Doi jucători cu același nume: respins la înscriere (nume unic).

## Testare

- Teste unitare pe `scorePrediction` (toate combinațiile: 1X2 corect, scor exact, greșit, fără pronostic).
- Teste pe blocarea la kickoff (server-side).
- Scraperul testat pe HTML/JSON salvat local (fixtures), nu pe site-ul live.

## În afara scopului (deocamdată)

Notificări push, ligi/competiții multiple, cote de pariuri, chat, statistici avansate. Se pot adăuga ulterior.
