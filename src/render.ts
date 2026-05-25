// Polished design (P6 · Pure ink). Single inline-CSS HTML document, no
// external assets, no framework. JS-off works — the inline script only
// upgrades the open-now pill, rewrites today's hours if view-day != build-day,
// and opens disclosures on weekends.

import { Restaurant, ScrapeResult, WeekdayKey, WeeklyHours } from "./types";
import { WEEKDAY_KEYS as DAY_KEYS, daySv, keyFromSv } from "./hours";

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
  return r.menu.length === 1 && !keyFromSv(r.menu[0].day);
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

const VIEW_DAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

// Per-card serialised menu: each weekday → tag-split items. The day-bar JS
// reads this to swap the visible items when another day is picked.
function menuAttr(r: Restaurant): string {
  const out: Record<string, Item[]> = {};
  for (const day of VIEW_DAYS) {
    const sv = daySv(day);
    const dm = r.menu.find((m) => m.day === sv);
    out[day] = dm ? dm.lines.map(splitItem) : [];
  }
  return esc(JSON.stringify(out));
}

function renderDayBar(activeKey: WeekdayKey): string {
  const btns = VIEW_DAYS.map((k) => {
    const isActive = k === activeKey;
    const cls = `daybtn${isActive ? " is-today" : ""}`;
    return `<button type="button" class="${cls}" data-day="${k}" aria-pressed="${isActive}">${esc(daySv(k))}</button>`;
  }).join("");
  return `<nav class="daybar" aria-label="Veckodag"><div class="daybar-inner" id="daybar">${btns}</div></nav>`;
}

function renderCard(r: Restaurant, todayKey: WeekdayKey): string {
  const wholeWeek = isWholeWeekMenu(r);
  const isWeekend = todayKey === "sat" || todayKey === "sun";
  const todayName = daySv(todayKey);

  // Today's menu entry: whole-week takes the lone entry; weekdays match by
  // Swedish day name; weekends fall back to nothing — the day-bar lets the
  // viewer pick another day.
  const todayEntry = wholeWeek
    ? r.menu[0]
    : isWeekend
      ? null
      : (r.menu.find((m) => m.day === todayName) ?? null);
  const todayLines = todayEntry?.lines ?? [];
  const todayHrs = hoursTodayLabel(r.hours, todayKey);

  // SSR initial pill state — JS will refine at view time. On weekends or
  // closed days we render "Stängt idag" so the JS-off case is honest.
  const slots = r.hours?.[todayKey] ?? [];
  const initialPillCls = slots.length ? "open" : "closed";
  const initialPillText = slots.length ? "Öppet nu" : "Stängt idag";

  const note = r.note ? `<span class="note">${esc(r.note)}</span>` : "";
  const price = r.price
    ? `<span class="price">${esc(r.price)}</span>`
    : "";
  const web = r.website
    ? `<a href="${esc(r.website)}" rel="noopener">webbplats ↗</a>`
    : "";

  // The IDAG/HELA VECKAN strip lives inside .when. "IDAG · " is wrapped so
  // the day-bar JS can hide it when the viewer picks a day other than today.
  const leftLabel = wholeWeek
    ? `<span>HELA VECKAN</span>`
    : isWeekend
      ? ""
      : `<span class="idag-prefix"><span>IDAG</span><span class="sep">·</span></span><span class="day">${esc(
          todayName.toUpperCase(),
        )}</span>`;

  const wholeWeekBanner = wholeWeek
    ? `<p class="wholeweek">Samma meny mån–fre.</p>`
    : "";

  const itemsBlock = `<ul class="items">${todayLines.map(renderItem).join("")}</ul>`;

  // Whole-week and weekend cards aren't day-switchable, so no data-menu.
  const menuData = wholeWeek || isWeekend ? "" : ` data-menu="${menuAttr(r)}"`;

  return `<li class="card" data-hours="${hoursAttr(r.hours)}"${menuData}>
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
      ${leftLabel}
      <span class="hours" data-today-hours>${esc(todayHrs)}</span>
      <span class="pill ${initialPillCls}" data-state-pill><span class="dot"></span>${initialPillText}</span>
    </div>
    ${wholeWeekBanner}
    ${itemsBlock}
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
body{margin:0;background:var(--paper-0);color:var(--ink);font-family:var(--sans);font-size:14.5px;line-height:1.4;-webkit-font-smoothing:antialiased;letter-spacing:-.005em;font-feature-settings:'ss01' 1}
.page{max-width:720px;margin:0 auto;padding:0 20px 48px}
a{color:var(--ink);text-decoration-color:var(--hair);text-decoration-thickness:1px;text-underline-offset:3px}
a:hover{text-decoration-color:var(--ink);color:var(--ink)}
a:focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:3px}
.top{padding:28px 0 12px}
.top h1{font-size:clamp(26px,6.5vw,34px);font-weight:800;letter-spacing:-.025em;line-height:1.05;margin:0 0 6px}
.top h1 .accent{color:var(--accent)}
.top .dateline{font-size:13.5px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.top .dateline .sep{color:var(--ink-3)}
.top .dateline .live{display:inline-flex;align-items:center;gap:6px;color:var(--ink);font-weight:500}
.top .dateline .live .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
.daybar{margin:14px 0 6px;padding:4px;background:var(--paper-1);border:1px solid var(--hair);border-radius:12px;box-shadow:0 1px 0 oklch(100% 0 0 / 0.4) inset,0 1px 2px oklch(22% 0.022 50 / 0.04);position:sticky;top:8px;z-index:4}
.daybar-inner{display:grid;grid-template-columns:repeat(5,1fr);gap:0}
.daybtn{appearance:none;border:0;background:transparent;font-family:inherit;cursor:pointer;padding:11px 8px 13px;border-radius:9px;position:relative;color:var(--ink-3);font-size:14.5px;font-weight:600;letter-spacing:-.005em;transition:color .14s ease,background .14s ease;outline:none}
.daybtn:hover{color:var(--ink)}
.daybtn:focus-visible{box-shadow:0 0 0 2px var(--accent) inset}
.daybtn.is-today::after{content:'';position:absolute;left:50%;bottom:4px;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--accent)}
.daybtn[aria-pressed="true"]{background:var(--ink);color:var(--paper-1);box-shadow:0 1px 2px oklch(0% 0 0 / 0.12)}
.daybtn[aria-pressed="true"]:hover{color:var(--paper-1)}
.daybtn.is-today[aria-pressed="true"]::after{background:var(--paper-1)}
.idag-prefix{display:contents}
.when[data-not-today] [data-state-pill]{display:none}
.cards{margin:12px 0 0;display:flex;flex-direction:column;gap:10px;list-style:none;padding:0}
.card{background:var(--paper-1);border:1px solid var(--hair);border-radius:var(--radius);padding:14px 14px 12px;box-shadow:0 1px 0 oklch(100% 0 0 / .5) inset,0 1px 2px oklch(14% 0 0 / .04),0 6px 20px -16px oklch(14% 0 0 / .18)}
.head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0}
.name{font-size:19px;font-weight:700;letter-spacing:-.015em;line-height:1.1;margin:0;color:var(--ink)}
.note{font-size:11.5px;font-weight:500;color:var(--ink-3);letter-spacing:.02em;padding:1px 6px;border-radius:5px;background:var(--paper-2)}
.meta{margin:4px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;font-size:12.5px;color:var(--ink-2)}
.meta .price{font-size:11.5px;font-weight:600;color:var(--ink);padding:1px 6px;border-radius:5px;background:var(--accent-soft);letter-spacing:-.005em}
.meta a{font-weight:500}
.when{margin:10px 0 4px;padding:3px 0 3px 9px;border-left:3px solid var(--accent);display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.when .day{color:var(--ink)}
.when .sep{color:var(--ink-3);font-weight:600}
.when .hours{font-feature-settings:'tnum' 1;font-weight:600;color:var(--ink);letter-spacing:-.005em;text-transform:none;font-size:13px;margin-left:auto}
.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:600;letter-spacing:.02em;text-transform:none}
.pill .dot{width:5px;height:5px;border-radius:50%;background:currentColor}
.pill.open{background:var(--ok-soft);color:var(--ok)}
.pill.closed,.pill.opens{background:var(--paper-2);color:var(--ink-2)}
.pill.error{background:var(--bad-soft);color:var(--bad)}
.items{margin:2px 0 0;padding:0 0 0 13px;list-style:none}
.item{position:relative;padding:3px 0;font-size:13.5px;line-height:1.4;color:var(--ink);text-wrap:pretty}
.item::before{content:'';position:absolute;left:-11px;top:10px;width:4px;height:4px;border-radius:50%;background:var(--accent)}
.item .tag{font-weight:700;color:var(--ink);margin-right:4px}
.item .tag::after{content:':';margin-right:4px;color:var(--ink-3)}
.item.no-tag .tag{display:none}
.wholeweek{margin:4px 0 0;font-size:12px;color:var(--ink-2);font-style:italic}
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
const VIEW_DAYS=['mon','tue','wed','thu','fri'];
function nowSthlm(){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t).value;
  return{day:g('weekday').toLowerCase().slice(0,3),mins:parseInt(g('hour'),10)*60+parseInt(g('minute'),10)};
}
function toMins(h){const[a,b]=h.split(':').map(Number);return a*60+b}
function fmt(s){return s[0]+'–'+s[1]}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function renderItem(it){
  const tag=it.tag?'<span class="tag">'+esc(it.tag)+'</span>':'';
  const cls=it.tag?'item':'item no-tag';
  return '<li class="'+cls+'">'+tag+esc(it.text)+'</li>';
}
const t=nowSthlm();
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
document.querySelectorAll('.daybtn').forEach(b=>{
  b.classList.toggle('is-today',b.dataset.day===t.day);
});
function applyDay(dayKey){
  document.querySelectorAll('.daybtn').forEach(b=>{
    b.setAttribute('aria-pressed',b.dataset.day===dayKey?'true':'false');
  });
  document.querySelectorAll('.card[data-menu]').forEach(card=>{
    let menu;try{menu=JSON.parse(card.getAttribute('data-menu'))}catch(e){return}
    let hours;try{hours=JSON.parse(card.getAttribute('data-hours'))}catch(e){return}
    const items=menu[dayKey]||[];
    const itemsEl=card.querySelector('.items');
    if(itemsEl)itemsEl.innerHTML=items.map(renderItem).join('');
    const dayLabel=card.querySelector('.when .day');
    if(dayLabel)dayLabel.textContent=(DAY_NAMES[dayKey]||'').toUpperCase();
    const hoursEl=card.querySelector('[data-today-hours]');
    if(hoursEl){
      const slots=hours[dayKey]||[];
      hoursEl.textContent=slots.length?fmt(slots[0]):'stängt';
    }
    const prefix=card.querySelector('.idag-prefix');
    if(prefix)prefix.style.display=(dayKey===t.day)?'':'none';
    const when=card.querySelector('.when');
    if(when){
      if(dayKey===t.day)when.removeAttribute('data-not-today');
      else when.setAttribute('data-not-today','');
    }
  });
}
document.querySelectorAll('.daybtn').forEach(b=>{
  b.addEventListener('click',function(){applyDay(b.dataset.day)});
});
if(VIEW_DAYS.indexOf(t.day)!==-1)applyDay(t.day);
})();`;
}

export function render(result: ScrapeResult): string {
  const { restaurants, fetchedAt } = result;
  const built = fmtBuild(fetchedAt);
  const todayKey = built.dayKey;
  const todayDayName = daySv(todayKey);

  const cards = restaurants
    .map((r) =>
      r.error
        ? renderErrorCard(r, r.error, fetchedAt)
        : renderCard(r, todayKey),
    )
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
${renderDayBar(VIEW_DAYS.includes(todayKey) ? todayKey : "mon")}
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
