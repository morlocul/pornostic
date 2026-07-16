# ⚽ Pronosticuri Liga 1

Aplicație de pronosticuri pentru SuperLiga României, pentru un grup de prieteni.
Punctaj: 1X2 corect = 1 punct, scor exact = 2 puncte. Pronosticurile se închid cu o oră înainte de fiecare meci.

## Rulare locală

1. `npm install`
2. Creează un proiect gratuit pe [supabase.com](https://supabase.com) → SQL Editor → rulează conținutul din `supabase/schema.sql`.
3. Copiază `.env.example` în `.env.local` și completează:
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — din Supabase: Settings → API (folosește cheia `service_role`, NU `anon`).
   - `SESSION_SECRET`, `CRON_SECRET` — orice șiruri aleatorii lungi (`openssl rand -hex 32` sau [random.org](https://random.org)).

   > ⚠️ **`SESSION_SECRET` și `CRON_SECRET` sunt obligatorii în producție** — nu le lăsa goale la deploy. Dacă `CRON_SECRET` lipsește, endpoint-ul de cron ajunge să accepte literalmente header-ul `Bearer undefined`, adică oricine îl poate declanșa. Fără `SESSION_SECRET` securitatea sesiunilor e compromisă (autentificarea nu mai e de încredere).
4. `npm run dev` → http://localhost:3000
5. Înscrie-te — **primul cont creat devine admin**.
6. Din pagina Admin, apasă „Rulează scraperul acum" ca să populezi meciurile.

## Deploy pe Vercel (gratuit)

1. Urcă repo-ul pe GitHub.
2. [vercel.com](https://vercel.com) → Add New Project → importă repo-ul → Framework: Next.js (auto).
3. La Environment Variables adaugă toate cele 4 variabile din `.env.local` (inclusiv `SESSION_SECRET` și `CRON_SECRET` — vezi avertismentul de mai sus).
4. Deploy. Primești un URL gen `https://pronosticuri.vercel.app` — trimite-l prietenilor.
5. Cron zilnic Vercel: e deja configurat în `vercel.json` (rulează la 08:00 UTC).

## Scraper des (GitHub Actions, gratuit)

În repo pe GitHub → Settings:
- Secrets and variables → Actions → **Secrets** → `CRON_SECRET` = aceeași valoare ca pe Vercel.
- Secrets and variables → Actions → **Variables** → `APP_URL` = URL-ul Vercel (fără slash final).

Workflow-ul `.github/workflows/scrape.yml` rulează la fiecare 30 min (10:00–21:30 UTC). Îl poți porni și manual (workflow_dispatch) din tab-ul **Actions**.

## Dacă scraperul dă 403 (Sofascore blochează Vercel)

Aplicația trece automat pe TheSportsDB. Dacă și acela e incomplet, adaugă/corectează meciurile din pagina **Admin** — tot ce e „fixat" manual nu mai e atins de scraper.

## Teste

`npm test`
