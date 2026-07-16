const DROP = new Set(['fc', 'afc', 'acs', 'cs', 'csm', 'sc', 'club', 'fotbal', 'ac', 'as', 'fk']);
const ALIASES: Record<string, string> = {
  'u cluj': 'universitatea cluj',
  'poli iasi': 'politehnica iasi',
  'u craiova': 'universitatea craiova',
  'sepsi osk': 'sepsi',
  'sepsi osk sfantu gheorghe': 'sepsi',
  'corvinul hunedoara': 'hunedoara',
};

export function normalizeTeam(name: string): string {
  let s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\./g, '');
  s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = s.split(' ').filter((t) => !DROP.has(t));
  s = tokens.join(' ') || s; // never return empty (e.g. name was just "FC")
  return ALIASES[s] ?? s;
}
