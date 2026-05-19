// Polished design (P6 · Pure ink). Single inline-CSS HTML document, no
// external assets, no framework. JS-off works — the inline script only
// upgrades the open-now pill, rewrites today's hours if view-day != build-day,
// and opens disclosures on weekends.

import { Restaurant, ScrapeResult, WeekdayKey, WeeklyHours } from "./types";

const DAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const DAY_NAMES: Record<WeekdayKey, string> = {
  mon: "Måndag",
  tue: "Tisdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
  sat: "Lördag",
  sun: "Söndag",
};

const SV_TO_KEY: Record<string, WeekdayKey> = {
  måndag: "mon",
  tisdag: "tue",
  onsdag: "wed",
  torsdag: "thu",
  fredag: "fri",
  lördag: "sat",
  söndag: "sun",
};

function esc(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtBuild(d: Date): {
  ymd: string;
  hm: string;
  dayKey: WeekdayKey;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) =>
    (parts.find((p) => p.type === t) as Intl.DateTimeFormatPart).value;
  return {
    ymd: `${g("year")}-${g("month")}-${g("day")}`,
    hm: `${g("hour")}:${g("minute")}`,
    dayKey: g("weekday").toLowerCase().slice(0, 3) as WeekdayKey,
  };
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function hoursTodayLabel(
  hours: WeeklyHours | undefined,
  day: WeekdayKey,
): string {
  const slots = hours?.[day] ?? [];
  if (slots.length === 0) return "stängt idag";
  return `${slots[0].open}–${slots[0].close}`;
}

function hoursAttr(hours: WeeklyHours | undefined): string {
  const out: Record<WeekdayKey, [string, string][]> = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
  for (const d of DAY_KEYS) {
    const slots = hours?.[d] ?? [];
    out[d] = slots.map((s): [string, string] => [s.open, s.close]);
  }
  return esc(JSON.stringify(out));
}

function isWholeWeekMenu(r: Restaurant): boolean {
  return (
    r.menu.length === 1 && !SV_TO_KEY[r.menu[0].day.trim().toLowerCase()]
  );
}

// Items are scraped as concatenated strings like "Green: Pasta med ...".
// Split a short capitalised prefix into a tag so the design's bold-tag rule
// can do its work. Inspira's awkward "Green | Bakad …: …" lines fall through
// as untagged.
type Item = { tag?: string; text: string };

function splitItem(line: string): Item {
  const colon = line.match(/^([A-ZÅÄÖ][^:|]{0,25}?):\s+(.+)$/);
  if (colon) return { tag: colon[1].trim(), text: colon[2].trim() };
  const dash = line.match(/^([A-ZÅÄÖ][^—]{0,30}?)\s—\s(.+)$/);
  if (dash) return { tag: dash[1].trim(), text: dash[2].trim() };
  return { text: line };
}

function renderItem(line: string): string {
  const it = splitItem(line);
  const tag = it.tag ? `<span class="tag">${esc(it.tag)}</span>` : "";
  const cls = it.tag ? "item" : "item no-tag";
  return `<li class="${cls}">${tag}${esc(it.text)}</li>`;
}

function renderWeekDay(day: string, lines: string[]): string {
  return `<div class="week-day"><p class="week-day-title">${esc(day)}</p><ul class="items">${lines
    .map(renderItem)
    .join("")}</ul></div>`;
}

function renderCard(r: Restaurant, todayKey: WeekdayKey): string {
  const wholeWeek = isWholeWeekMenu(r);
  const todayName = DAY_NAMES[todayKey];
  const todayEntry = wholeWeek
    ? r.menu[0]
    : (r.menu.find((m) => m.day === todayName) ?? r.menu[0]);
  const restOfWeek = wholeWeek
    ? []
    : r.menu.filter((m) => m !== todayEntry);
  const todayLines = todayEntry?.lines ?? [];
  const todayHrs = hoursTodayLabel(r.hours, todayKey);

  const note = r.note
    ? `<span class="note">${esc(r.note)}</span>`
    : "";
  const price = r.price
    ? `<span class="price">${esc(r.price)}</span>`
    : "";
  const web = r.website
    ? `<a href="${esc(r.website)}" rel="noopener">webbplats ↗</a>`
    : "";

  const idagStrip = wholeWeek
    ? `<div class="idag"><span>HELA VECKAN</span></div>`
    : `<div class="idag"><span>IDAG</span><span class="sep">·</span><span class="day">${esc(
        todayName.toUpperCase(),
      )}</span></div>`;

  const wholeWeekBanner = wholeWeek
    ? `<p class="wholeweek">Samma meny mån–fre.</p>`
    : "";

  const disclosure = restOfWeek.length
    ? `<details class="week"><summary>Resten av veckan</summary>${restOfWeek
        .map((d) => renderWeekDay(d.day, d.lines))
        .join("")}</details>`
    : "";

  return `<li class="card" data-hours="${hoursAttr(r.hours)}">
    <div class="head">
      <h2 class="name">${esc(r.name)}</h2>
      ${note}
    </div>
    <div class="meta">
      <span>${esc(r.address)}</span>
      ${price}
      ${web}
    </div>
    <div class="when">
      <span class="hours"><span class="lab">Idag</span><span data-today-hours>${esc(todayHrs)}</span></span>
      <span class="pill open" data-state-pill><span class="dot"></span>Öppet nu</span>
    </div>
    ${idagStrip}
    ${wholeWeekBanner}
    <ul class="items">${todayLines.map(renderItem).join("")}</ul>
    ${disclosure}
  </li>`;
}

function renderErrorCard(
  r: Restaurant,
  err: { source: string; error: string },
  fetchedAt: Date,
): string {
  const site = r.website ? stripScheme(r.website) : err.source;
  const link = r.website
    ? `<a href="${esc(r.website)}" rel="noopener">${esc(site)}</a>`
    : esc(site);
  const when = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fetchedAt);
  const detail = `Senaste försök ${when} · ${err.error}`;
  return `<li class="card is-error">
    <div class="head">
      <h2 class="name">${esc(r.name)}</h2>
    </div>
    <div class="meta">
      <span>${esc(r.address)}</span>
      ${r.website ? `<a href="${esc(r.website)}" rel="noopener">webbplats ↗</a>` : ""}
    </div>
    <div class="when">
      <span class="pill error"><span class="dot"></span>Kunde inte hämta menyn</span>
    </div>
    <div class="scrape-fail">
      <span class="ico">↻</span>
      <div>
        Något gick fel när menyn hämtades. Kolla ${link} direkt.
        <div class="errwhen">${esc(detail)}</div>
      </div>
    </div>
  </li>`;
}

const CSS = `:root{--paper-0:oklch(97% 0.003 90);--paper-1:oklch(99% 0.002 90);--paper-2:oklch(93% 0.004 90);--ink:oklch(14% 0 0);--ink-2:oklch(42% 0 0);--ink-3:oklch(62% 0 0);--hair:oklch(86% 0.003 90);--rule:oklch(78% 0.004 90);--accent:oklch(14% 0 0);--accent-soft:oklch(92% 0.003 90);--ok:oklch(50% 0.12 145);--ok-soft:oklch(93% 0.04 145);--bad:oklch(52% 0.16 25);--bad-soft:oklch(93% 0.04 25);--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,'Helvetica Neue',Arial,sans-serif;--radius:14px}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--paper-0)}
body{margin:0;background:var(--paper-0);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased;letter-spacing:-.005em;font-feature-settings:'ss01' 1}
.page{max-width:720px;margin:0 auto;padding:0 20px 48px}
a{color:var(--ink);text-decoration-color:var(--hair);text-decoration-thickness:1px;text-underline-offset:3px}
a:hover{text-decoration-color:var(--ink);color:var(--ink)}
a:focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:3px}
.top{padding:36px 0 14px}
.top h1{font-size:clamp(28px,7vw,38px);font-weight:800;letter-spacing:-.025em;line-height:1.05;margin:0 0 8px}
.top h1 .accent{color:var(--accent)}
.top .dateline{font-size:13.5px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.top .dateline .sep{color:var(--ink-3)}
.top .dateline .live{display:inline-flex;align-items:center;gap:6px;color:var(--ink);font-weight:500}
.top .dateline .live .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
.cards{margin:14px 0 0;display:flex;flex-direction:column;gap:16px;list-style:none;padding:0}
.card{background:var(--paper-1);border:1px solid var(--hair);border-radius:var(--radius);padding:18px 18px 16px;box-shadow:0 1px 0 oklch(100% 0 0 / .5) inset,0 1px 2px oklch(14% 0 0 / .04),0 8px 28px -20px oklch(14% 0 0 / .15)}
.head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0}
.name{font-size:22px;font-weight:700;letter-spacing:-.015em;line-height:1.15;margin:0;color:var(--ink)}
.note{font-size:12.5px;font-weight:500;color:var(--ink-3);letter-spacing:.02em;padding:2px 7px;border-radius:6px;background:var(--paper-2)}
.meta{margin:8px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:13.5px;color:var(--ink-2)}
.meta .price{font-size:12.5px;font-weight:600;color:var(--ink);padding:2px 7px;border-radius:6px;background:var(--accent-soft);letter-spacing:-.005em}
.meta a{font-weight:500}
.when{margin:12px 0 0;display:flex;align-items:center;gap:10px;font-size:14px}
.when .hours{font-feature-settings:'tnum' 1;font-weight:600;color:var(--ink)}
.when .hours .lab{color:var(--ink-3);font-weight:500;margin-right:6px;text-transform:lowercase;letter-spacing:-.005em}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.02em}
.pill .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.open{background:var(--ok-soft);color:var(--ok)}
.pill.closed,.pill.opens{background:var(--paper-2);color:var(--ink-2)}
.pill.error{background:var(--bad-soft);color:var(--bad)}
.idag{margin:16px 0 6px;padding:4px 0 4px 10px;border-left:3px solid var(--accent);font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:8px}
.idag .sep{color:var(--ink-3);font-weight:600}
.idag .day{color:var(--ink)}
.items{margin:4px 0 0;padding:0 0 0 14px;list-style:none}
.item{position:relative;padding:6px 0;font-size:14.5px;line-height:1.45;color:var(--ink);text-wrap:pretty}
.item::before{content:'';position:absolute;left:-12px;top:13px;width:5px;height:5px;border-radius:50%;background:var(--accent)}
.item .tag{font-weight:700;color:var(--ink);margin-right:4px}
.item .tag::after{content:':';margin-right:4px;color:var(--ink-3)}
.item.no-tag .tag{display:none}
.wholeweek{margin:8px 0 0;font-size:12.5px;color:var(--ink-2);font-style:italic}
.week{margin-top:12px}
.week>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px 6px 8px;margin-left:-8px;font-size:13px;color:var(--ink-2);font-weight:500;border-radius:8px}
.week>summary:hover{background:var(--paper-2);color:var(--ink)}
.week>summary::-webkit-details-marker{display:none}
.week>summary::before{content:'▸';color:var(--accent);transition:transform .15s ease}
.week[open]>summary::before{transform:rotate(90deg)}
.week-day{margin-top:10px}
.week-day-title{font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin:0 0 4px}
.week-day .items{padding-left:14px}
.week-day .item{padding:4px 0;font-size:13.5px;color:var(--ink-2)}
.week-day .item::before{background:var(--ink-3);top:12px}
.week-day .item .tag{color:var(--ink-2)}
.scrape-fail{margin:10px 0 0;padding:12px 14px;background:var(--bad-soft);border:1px solid var(--hair);border-radius:10px;font-size:13.5px;color:var(--ink-2);display:flex;align-items:flex-start;gap:10px}
.scrape-fail .ico{color:var(--bad);font-weight:800;line-height:1.3}
.scrape-fail .errwhen{margin-top:4px;font-size:11.5px;color:var(--ink-3);letter-spacing:.04em}
.scrape-fail a{font-weight:600}
.card.is-error .name{color:var(--ink-2)}
.foot{margin-top:36px;padding:22px 0 0;border-top:1px solid var(--hair);font-size:13px;color:var(--ink-2)}
.foot .row{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
.foot .row+.row{margin-top:10px}
.foot .lbl{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.foot a{color:var(--ink)}
.foot .colophon{margin-top:18px;font-size:12px;color:var(--ink-3);font-style:italic}`;

function inlineScript(buildDayKey: WeekdayKey): string {
  return `(function(){
const BUILD_DAY=${JSON.stringify(buildDayKey)};
const DAY_NAMES={mon:'Måndag',tue:'Tisdag',wed:'Onsdag',thu:'Torsdag',fri:'Fredag',sat:'Lördag',sun:'Söndag'};
function nowSthlm(){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t).value;
  return{day:g('weekday').toLowerCase().slice(0,3),mins:parseInt(g('hour'),10)*60+parseInt(g('minute'),10)};
}
function toMins(h){const[a,b]=h.split(':').map(Number);return a*60+b}
function fmt(s){return s[0]+'–'+s[1]}
const t=nowSthlm();
const weekend=(t.day==='sat'||t.day==='sun');
document.querySelectorAll('.card[data-hours]').forEach(el=>{
  let h;try{h=JSON.parse(el.getAttribute('data-hours'))}catch(e){return}
  const slots=h[t.day]||[];
  const hoursEl=el.querySelector('[data-today-hours]');
  const pillEl=el.querySelector('[data-state-pill]');
  if(!pillEl)return;
  if(hoursEl&&t.day!==BUILD_DAY)hoursEl.textContent=slots.length?fmt(slots[0]):'stängt idag';
  function setPill(cls,text){pillEl.className='pill '+cls;pillEl.innerHTML='<span class="dot"></span>'+text}
  if(slots.length===0){setPill('closed','Stängt idag');return}
  const open=slots.find(x=>t.mins>=toMins(x[0])&&t.mins<toMins(x[1]));
  if(open){setPill('open','Öppet nu');return}
  const up=slots.find(x=>t.mins<toMins(x[0]));
  if(up)setPill('opens','Öppnar '+up[0]);else setPill('closed','Stängt');
});
const dayEl=document.querySelector('[data-today-day]');
if(dayEl&&t.day!==BUILD_DAY)dayEl.textContent=DAY_NAMES[t.day];
if(t.day!==BUILD_DAY){
  const dn=(DAY_NAMES[t.day]||'').toUpperCase();
  document.querySelectorAll('.idag .day').forEach(el=>{el.textContent=dn});
}
if(weekend)document.querySelectorAll('details.week').forEach(d=>d.setAttribute('open',''));
})();`;
}

export function render(result: ScrapeResult): string {
  const { restaurants, errors, fetchedAt } = result;
  const built = fmtBuild(fetchedAt);
  const todayKey = built.dayKey;
  const todayDayName = DAY_NAMES[todayKey];

  // Match each error to a restaurant by source string vs name/hostname.
  const errorFor = (r: Restaurant) => {
    const host = (r.website ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    const hay = [r.name, host].filter(Boolean).map((s) => s.toLowerCase());
    return errors.find((e) => {
      const s = e.source.toLowerCase();
      return hay.some((h) => h.includes(s) || s.includes(h));
    });
  };

  const cards = restaurants
    .map((r) => {
      const e = errorFor(r);
      return e ? renderErrorCard(r, e, fetchedAt) : renderCard(r, todayKey);
    })
    .join("\n");

  const sourceLinks = restaurants
    .filter((r) => r.website)
    .map(
      (r) =>
        `<a href="${esc(r.website!)}" rel="noopener">${esc(stripScheme(r.website!))}</a>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lunch nära Mobilvägen 10 · ${esc(todayDayName)}</title>
<meta name="description" content="Dagens lunchmenyer för sex ställen kring Mobilvägen, Ideon.">
<meta name="theme-color" content="#f7efe1">
<link rel="alternate" type="application/json" href="https://stromdahl.github.io/lunchlund.json">
<link rel="alternate" type="application/rss+xml" href="https://stromdahl.github.io/lunchlund.xml" title="Lunchlund · RSS">
<style>${CSS}</style>
</head>
<body>
<div class="page">
<header class="top">
<h1>Lunch nära <span class="accent">Mobilvägen 10</span></h1>
<div class="dateline">
<span class="live"><span class="dot"></span>Uppdaterad</span>
<span>${esc(built.ymd)} · ${esc(built.hm)}</span>
<span class="sep">·</span>
<span data-today-day>${esc(todayDayName)}</span>
</div>
</header>
<ol class="cards">
${cards}
</ol>
<footer class="foot">
<div class="row">
<span class="lbl">Feeds</span>
<a href="https://stromdahl.github.io/lunchlund.json">JSON</a>
<a href="https://stromdahl.github.io/lunchlund.xml">RSS</a>
</div>
<div class="row">
<span class="lbl">Källor</span>
${sourceLinks}
</div>
<div class="colophon">Lunchlund · uppdateras varje vardagsmorgon · Europe/Stockholm</div>
</footer>
</div>
<script>${inlineScript(todayKey)}</script>
</body>
</html>
`;
}
