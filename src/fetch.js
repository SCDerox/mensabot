export const BASE = 'https://stwno.de/infomax/daten-extern/html/';

export async function fetchMenuHtml(date, locId = 'UNI-P') {
  const res = await fetch(BASE + 'speiseplan-render.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ func: 'make_spl', locId, lang: 'de', date, w: '' }),
  });
  if (!res.ok) throw new Error(`Menu request failed: HTTP ${res.status}`);
  return res.text();
}
