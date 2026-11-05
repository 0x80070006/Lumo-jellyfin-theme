/*
 * Lumo — couche interactive pour Jellyfin 12
 * Hero cinématique, rail des studios, dé + roulette.
 *
 * Principes :
 *  - n'utilise que l'API publique via window.ApiClient (aucun jeton manipulé) ;
 *  - ne masque ni ne déplace aucun élément natif : tout est ajouté à côté ;
 *  - chaque module échoue seul, en silence : l'interface native reste utilisable ;
 *  - pas de MutationObserver global ni de setInterval : on réagit aux
 *    événements de navigation de Jellyfin (viewshow, hashchange).
 */
(() => {
  "use strict";
  if (window.__lumo) return;
  window.__lumo = { version: "1.2.2" };

  const LOG = "[Lumo]";
  const BASE = (() => {
    if (window.LUMO_BASE) return String(window.LUMO_BASE).replace(/\/?$/, "/");
    const src = document.currentScript && document.currentScript.src;
    if (src && /lumo(\.min)?\.js/.test(src)) return src.replace(/lumo(\.min)?\.js.*$/, "");
    return "https://cdn.jsdelivr.net/gh/0x80070006/Lumo-jellyfin-theme@1.2.2/";
  })();

  const CONFIG = Object.assign({
    heroItems: 8,
    heroIntervalMs: 8000,
    diceHistory: 60
  }, window.LUMO_CONFIG || {});

  const STUDIOS = [
    { label: "Pixar", aliases: ["Pixar", "Pixar Animation Studios"], colors: ["#0f6bd8", "#071a3a"], logo: "pixar.svg" },
    { label: "Marvel", aliases: ["Marvel Studios", "Marvel Entertainment", "Marvel"], colors: ["#c8102e", "#3a0510"], logo: "marvel-studios.svg" },
    { label: "Disney", aliases: ["Walt Disney Pictures", "Walt Disney Animation Studios", "Walt Disney Feature Animation", "Walt Disney Productions", "Walt Disney"], colors: ["#1d4fd8", "#0b1440"], logo: "disney.svg" },
    { label: "DreamWorks", aliases: ["DreamWorks Animation", "DreamWorks Pictures"], colors: ["#2b6cb0", "#0c1d33"], logo: "dreamworks.svg" },
    { label: "20th Century", aliases: ["20th Century Fox", "20th Century Studios", "Twentieth Century Fox"], colors: ["#c77d12", "#3a1d04"], logo: "20th-century.svg" },
    { label: "Columbia", aliases: ["Columbia Pictures", "Columbia"], colors: ["#2a86c9", "#0d1b33"], logo: "columbia.svg" },
    { label: "Paramount", aliases: ["Paramount Pictures", "Paramount"], colors: ["#2f5bd6", "#0c1336"], logo: "paramount.svg" },
    { label: "Warner Bros.", aliases: ["Warner Bros. Pictures", "Warner Bros.", "Warner Bros. Animation"], colors: ["#1f5fae", "#0a1a30"] },
    { label: "Universal", aliases: ["Universal Pictures", "Illumination Entertainment", "Illumination"], colors: ["#3b4a63", "#0b0f18"] },
    { label: "Lucasfilm", aliases: ["Lucasfilm Ltd.", "Lucasfilm"], colors: ["#4b4b52", "#0e0e10"] },
    { label: "Netflix", kind: "platform", aliases: ["Netflix"], colors: ["#b20710", "#2a0204"], logo: "netflix.svg" },
    { label: "Prime Video", kind: "platform", aliases: ["Amazon Studios", "Amazon Prime Video", "Prime Video", "Amazon MGM Studios"], colors: ["#11466e", "#06131f"], logo: "prime-video.svg" },
    { label: "Apple TV+", kind: "platform", aliases: ["Apple TV+", "Apple Studios", "Apple Original Films"], colors: ["#3a3d45", "#0a0b0e"], logo: "apple-tv-plus.svg" },
    { label: "HBO", kind: "platform", aliases: ["HBO", "HBO Max", "Max"], colors: ["#4a2a8a", "#130b24"], logo: "hbo-max.svg" },
    { label: "Disney+", kind: "platform", aliases: ["Disney+"], colors: ["#123a6b", "#081626"], logo: "disney-plus.svg" },
    { label: "Hulu", kind: "platform", aliases: ["Hulu"], colors: ["#14532d", "#06150d"], logo: "hulu.svg" }
  ];

  const GENRES = [
    ["Action", ["Action"]],
    ["Aventure", ["Aventure", "Adventure"]],
    ["Animation", ["Animation"]],
    ["Anime", ["Anime"]],
    ["Comédie", ["Comédie", "Comedy"]],
    ["Crime", ["Crime"]],
    ["Drame", ["Drame", "Drama"]],
    ["Familial", ["Familial", "Family"]],
    ["Fantastique", ["Fantastique", "Fantasy", "Supernatural"]],
    ["Guerre", ["Guerre", "War"]],
    ["Histoire", ["Histoire", "History"]],
    ["Horreur", ["Horreur", "Horror"]],
    ["Musique", ["Musique", "Music"]],
    ["Mystère", ["Mystère", "Mystery"]],
    ["Romance", ["Romance"]],
    ["Science-fiction", ["Science-Fiction", "Science Fiction", "Sci-Fi"]],
    ["Thriller", ["Thriller", "Psychological"]],
    ["Western", ["Western"]]
  ];

  /* ───────── utilitaires ───────── */

  const $ = (sel, root = document) => root.querySelector(sel);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  function api() {
    const c = window.ApiClient;
    return c && c.getCurrentUserId && c.getCurrentUserId() ? c : null;
  }
  const uid = () => api().getCurrentUserId();
  const getJSON = (path, params) => api().getJSON(api().getUrl(path, params));
  const items = (params) => getJSON("Items", Object.assign({ userId: uid(), Recursive: true }, params));

  function img(id, type, opts = {}) {
    const p = { quality: 82 };
    if (opts.w) p.maxWidth = opts.w;
    if (opts.h) p.maxHeight = opts.h;
    if (opts.tag) p.tag = opts.tag;
    return api().getUrl(`Items/${id}/Images/${type}/${opts.index || 0}`, p);
  }
  const backdropOf = (it, w = 1920) =>
    it.BackdropImageTags && it.BackdropImageTags.length ? img(it.Id, "Backdrop", { w, tag: it.BackdropImageTags[0] })
      : it.ParentBackdropItemId && it.ParentBackdropImageTags?.length ? img(it.ParentBackdropItemId, "Backdrop", { w, tag: it.ParentBackdropImageTags[0] })
        : null;
  const posterOf = (it, h = 450) => it.ImageTags && it.ImageTags.Primary ? img(it.Id, "Primary", { h, tag: it.ImageTags.Primary }) : null;
  const logoOf = (it) => it.ImageTags && it.ImageTags.Logo ? img(it.Id, "Logo", { w: 640, tag: it.ImageTags.Logo }) : null;

  const cache = {
    get(key, maxAgeMs) {
      try {
        const raw = sessionStorage.getItem("lumo." + key);
        if (!raw) return null;
        const { t, v } = JSON.parse(raw);
        return Date.now() - t < maxAgeMs ? v : null;
      } catch { return null; }
    },
    set(key, v) { try { sessionStorage.setItem("lumo." + key, JSON.stringify({ t: Date.now(), v })); } catch { /* quota */ } }
  };
  const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem("lumo." + key)) ?? fallback; } catch { return fallback; } },
    set(key, v) { try { localStorage.setItem("lumo." + key, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  function shuffle(list) {
    const a = list.slice();
    const rnd = new Uint32Array(a.length);
    crypto.getRandomValues(rnd);
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd[i] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function goDetails(id) {
    window.location.hash = `#/details?id=${id}&serverId=${api().serverId()}`;
  }

  /* Lecture : on demande au serveur de jouer l'élément sur NOTRE session.
     C'est l'API « contrôle à distance » officielle ; elle évite de dépendre
     des modules internes de jellyfin-web. En cas d'échec, on ouvre la fiche. */
  async function play(item) {
    try {
      const c = api();
      const sessions = await getJSON("Sessions", { deviceId: c.deviceId() });
      const me = sessions && sessions[0];
      if (!me) throw new Error("session introuvable");
      const params = { playCommand: "PlayNow", itemIds: item.Id };
      const pos = item.UserData && item.UserData.PlaybackPositionTicks;
      if (pos) params.startPositionTicks = pos;
      await c.ajax({ type: "POST", url: c.getUrl(`Sessions/${me.Id}/Playing`, params) });
    } catch (e) {
      console.warn(LOG, "lecture directe impossible, ouverture de la fiche", e);
      goDetails(item.Id);
    }
  }

  const FIELDS = "Overview,Genres,OfficialRating,CommunityRating,RunTimeTicks,ProductionYear,ImageTags,BackdropImageTags,UserData,ChildCount";

  function metaChips(it) {
    const out = [];
    if (it.ProductionYear) out.push(it.ProductionYear);
    if (it.OfficialRating) out.push(it.OfficialRating);
    if (it.Type === "Series" && it.ChildCount) out.push(`${it.ChildCount} saison${it.ChildCount > 1 ? "s" : ""}`);
    else if (it.RunTimeTicks) {
      const m = Math.round(it.RunTimeTicks / 6e8);
      out.push(m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);
    }
    if (it.CommunityRating) out.push(`★ ${it.CommunityRating.toFixed(1)}`);
    (it.Genres || []).slice(0, 2).forEach((g) => out.push(g));
    return out.map((t) => `<span>${esc(t)}</span>`).join("");
  }

  /* ───────── hero ───────── */

  const hero = { node: null, list: [], index: 0, timer: null, paused: false };

  async function heroItems() {
    const key = "hero." + uid();
    const cached = cache.get(key, 30 * 60 * 1000);
    if (cached && cached.length) return cached;
    const res = await items({
      IncludeItemTypes: "Movie,Series",
      SortBy: "Random",
      Limit: CONFIG.heroItems * 3,
      ImageTypes: "Backdrop",
      HasOverview: true,
      Fields: FIELDS,
      EnableUserData: true
    });
    const list = (res.Items || []).filter((it) => it.BackdropImageTags && it.BackdropImageTags.length);
    // Les titres avec logo d'abord : le rendu est plus « affiche de cinéma ».
    list.sort((a, b) => (b.ImageTags?.Logo ? 1 : 0) - (a.ImageTags?.Logo ? 1 : 0));
    const picked = list.slice(0, CONFIG.heroItems);
    cache.set(key, picked);
    return picked;
  }

  function buildHero() {
    const node = el("section", "lumo-hero");
    node.setAttribute("aria-roledescription", "carrousel");
    node.setAttribute("aria-label", "À la une");
    node.tabIndex = -1;
    node.innerHTML = `
      <div class="lumo-hero__media"><div class="lumo-hero__img"></div><div class="lumo-hero__img"></div></div>
      <div class="lumo-hero__shade"></div>
      <div class="lumo-hero__body">
        <div class="lumo-hero__title"></div>
        <div class="lumo-hero__meta"></div>
        <p class="lumo-hero__overview"></p>
        <div class="lumo-hero__actions">
          <button type="button" class="lumo-btn lumo-btn--primary" data-act="play">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span>Lecture</span></button>
          <button type="button" class="lumo-btn" data-act="info">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 10h2v7h-2zm0-3h2v2h-2zm1-5a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"/></svg><span>Plus d'infos</span></button>
        </div>
      </div>
      <div class="lumo-hero__nav">
        <button type="button" class="lumo-round" data-act="prev" aria-label="Précédent"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <div class="lumo-hero__dots" role="tablist"></div>
        <button type="button" class="lumo-round" data-act="next" aria-label="Suivant"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>`;

    node.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const it = hero.list[hero.index];
      const act = b.dataset.act;
      if (act === "play" && it) play(it);
      else if (act === "info" && it) goDetails(it.Id);
      else if (act === "prev") showHero(hero.index - 1, true);
      else if (act === "next") showHero(hero.index + 1, true);
      else if (act === "dot") showHero(Number(b.dataset.i), true);
    });
    node.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { showHero(hero.index - 1, true); e.preventDefault(); }
      if (e.key === "ArrowRight") { showHero(hero.index + 1, true); e.preventDefault(); }
    });
    // Pause au survol / au focus : on ne change pas l'affiche sous les yeux.
    node.addEventListener("pointerenter", () => { hero.paused = true; });
    node.addEventListener("pointerleave", () => { hero.paused = false; });
    node.addEventListener("focusin", () => { hero.paused = true; });
    node.addEventListener("focusout", () => { hero.paused = false; });
    // Balayage tactile
    let x0 = null;
    node.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
    node.addEventListener("pointerup", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) showHero(hero.index + (dx < 0 ? 1 : -1), true);
    });
    return node;
  }

  function preload(url) {
    return new Promise((resolve) => {
      if (!url) return resolve();
      const i = new Image();
      i.decoding = "async";
      i.onload = i.onerror = () => resolve();
      i.src = url;
    });
  }

  let heroToken = 0;
  async function showHero(i, user) {
    const node = hero.node;
    if (!node || !hero.list.length) return;
    const n = hero.list.length;
    hero.index = ((i % n) + n) % n;
    const it = hero.list[hero.index];
    const token = ++heroToken;
    const url = backdropOf(it);
    await preload(url);
    if (token !== heroToken || !node.isConnected) return;

    const layers = node.querySelectorAll(".lumo-hero__img");
    const next = node.classList.toggle("lumo-hero--alt") ? layers[1] : layers[0];
    const prev = next === layers[0] ? layers[1] : layers[0];
    next.style.backgroundImage = url ? `url("${url}")` : "none";
    next.classList.add("is-on");
    prev.classList.remove("is-on");

    const body = node.querySelector(".lumo-hero__body");
    body.classList.remove("is-in");
    void body.offsetWidth; // relance l'animation d'entrée
    const logo = logoOf(it);
    node.querySelector(".lumo-hero__title").innerHTML = logo
      ? `<img src="${logo}" alt="${esc(it.Name)}" decoding="async">`
      : `<h2>${esc(it.Name)}</h2>`;
    node.querySelector(".lumo-hero__meta").innerHTML = metaChips(it);
    node.querySelector(".lumo-hero__overview").textContent = it.Overview || "";
    const resume = it.UserData && it.UserData.PlaybackPositionTicks > 0;
    node.querySelector('[data-act="play"] span').textContent = resume ? "Reprendre" : "Lecture";
    body.classList.add("is-in");

    node.querySelectorAll(".lumo-hero__dots button").forEach((d, k) => {
      d.setAttribute("aria-selected", String(k === hero.index));
    });
    preload(backdropOf(hero.list[(hero.index + 1) % n]));
    if (user) scheduleHero();
  }

  function scheduleHero() {
    clearTimeout(hero.timer);
    if (reducedMotion() || hero.list.length < 2) return;
    hero.timer = setTimeout(function tick() {
      if (!hero.node || !hero.node.isConnected) return;
      if (hero.paused || document.hidden) { hero.timer = setTimeout(tick, 1500); return; }
      showHero(hero.index + 1).then(scheduleHero);
    }, CONFIG.heroIntervalMs);
  }

  async function mountHero(container) {
    const node = buildHero();
    container.appendChild(node);
    hero.node = node;
    try {
      hero.list = await heroItems();
    } catch (e) {
      console.warn(LOG, "hero indisponible", e);
      hero.list = [];
    }
    if (!hero.list.length) { node.remove(); hero.node = null; return; }
    node.querySelector(".lumo-hero__dots").innerHTML = hero.list
      .map((it, k) => `<button type="button" role="tab" data-act="dot" data-i="${k}" aria-label="${esc(it.Name)}"></button>`)
      .join("");
    node.classList.add("is-ready");
    await showHero(0);
    scheduleHero();
  }

  /* ───────── studios ───────── */

  async function resolveStudios() {
    const key = "studios2." + uid();
    const cached = cache.get(key, 6 * 60 * 60 * 1000);
    if (cached) return cached;
    const res = await getJSON("Studios", { userId: uid(), Recursive: true, IncludeItemTypes: "Movie,Series", EnableImages: false });
    const byName = new Map((res.Items || []).map((s) => [norm(s.Name), s.Id]));
    const out = [];
    for (const def of STUDIOS) {
      const ids = [...new Set(def.aliases.map((a) => byName.get(norm(a))).filter(Boolean))];
      if (ids.length) out.push({ label: def.label, kind: def.kind || "studio", colors: def.colors, logo: def.logo || "", ids });
    }
    // On n'affiche que les studios qui ont vraiment du contenu, avec leur total.
    await Promise.all(out.map(async (s) => {
      try {
        const r = await items({ StudioIds: s.ids.join(","), IncludeItemTypes: "Movie,Series", Limit: 0, EnableTotalRecordCount: true });
        s.count = r.TotalRecordCount || 0;
      } catch { s.count = 0; }
    }));
    const kept = out.filter((s) => s.count > 0);
    cache.set(key, kept);
    return kept;
  }

  function studioTile(s) {
    const b = el("button", "lumo-studio");
    b.type = "button";
    b.style.setProperty("--a", s.colors[0]);
    b.style.setProperty("--b", s.colors[1]);
    b.setAttribute("aria-label", `${s.label}, ${s.count} titres`);
    b.innerHTML = (s.logo ? `<img src="${BASE}assets/logos/${s.logo}" alt="" loading="lazy" decoding="async">` : "")
      + `<span class="lumo-studio__name">${esc(s.label)}</span><span class="lumo-studio__count">${s.count}</span>`;
    const im = b.querySelector("img");
    if (im) {
      im.addEventListener("load", () => b.classList.add("has-logo"));
      im.addEventListener("error", () => im.remove());
    }
    b.addEventListener("click", () => openSheet(Object.assign({}, s, { param: "StudioIds" })));
    return b;
  }

  /* Carrousel commun : piste défilante + flèches qui avancent d'une « page »
     (5 tuiles pour les rails). Défilement natif : tactile, molette et clavier
     fonctionnent sans code supplémentaire. */
  const ARROW_L = `<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>`;
  const ARROW_R = `<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`;

  function carousel(cls, title, opts = {}) {
    const sec = el("section", `lumo-row ${cls}`);
    sec.innerHTML = `
      <div class="lumo-row__head">
        <h2 class="sectionTitle">${title}</h2>
        ${opts.more ? `<button type="button" class="lumo-row__more">Tout voir</button>` : ""}
        <div class="lumo-row__arrows">
          <button type="button" class="lumo-round lumo-row__prev" aria-label="Précédents" disabled>${ARROW_L}</button>
          <button type="button" class="lumo-round lumo-row__next" aria-label="Suivants">${ARROW_R}</button>
        </div>
      </div>
      <div class="lumo-row__track"></div>`;
    const track = sec.querySelector(".lumo-row__track");
    const prev = sec.querySelector(".lumo-row__prev");
    const next = sec.querySelector(".lumo-row__next");
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      sec.classList.toggle("is-static", max <= 0);
    };
    const page = (dir) => {
      const first = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = first ? first.getBoundingClientRect().width + gap : track.clientWidth;
      const perPage = Math.max(1, Math.round((track.clientWidth + gap) / step));
      track.scrollBy({ left: dir * perPage * step, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    prev.addEventListener("click", () => page(-1));
    next.addEventListener("click", () => page(1));
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(track);
    if (opts.more) sec.querySelector(".lumo-row__more").addEventListener("click", opts.more);
    sec._update = update;
    return { sec, track, update };
  }

  async function mountRails(container) {
    let list;
    try { list = await resolveStudios(); } catch (e) { console.warn(LOG, "studios indisponibles", e); return []; }
    if (!container.isConnected) return list;
    for (const [kind, title] of [["studio", "Studios"], ["platform", "Plateformes"]]) {
      const group = list.filter((s) => s.kind === kind).sort((a, b) => b.count - a.count);
      if (!group.length) continue;
      const { sec, track, update } = carousel("lumo-rail", title);
      group.forEach((s) => track.appendChild(studioTile(s)));
      container.appendChild(sec);
      update();
    }
    return list;
  }

  /* Rangées d'affiches (genres, studios) : chargées seulement à l'approche de
     l'écran, puis mises en cache pour la session. */
  const lazy = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      lazy.unobserve(e.target);
      e.target._load && e.target._load();
    }), { rootMargin: "600px 0px" })
    : null;

  function posterRow(container, def) {
    const { sec, track, update } = carousel("lumo-posters", esc(def.label));
    for (let k = 0; k < 5; k++) track.appendChild(el("span", "lumo-poster lumo-poster--ghost", `<span class="lumo-poster__img"></span>`));
    sec._load = async () => {
      try {
        const key = def.key || `row.${uid()}.${def.param}.${def.ids.join(",")}`;
        let list = cache.get(key, def.ttl || 30 * 60 * 1000);
        if (!list) {
          const raw = def.fetch ? await def.fetch() : (await items({
            [def.param]: def.ids.join(","), IncludeItemTypes: "Movie,Series", SortBy: "Random", Limit: 15,
            ImageTypes: "Primary", Fields: "ProductionYear,ImageTags"
          })).Items || [];
          list = raw.map((x) => ({ Id: x.Id, Name: x.Name, ProductionYear: x.ProductionYear, ImageTags: { Primary: x.ImageTags && x.ImageTags.Primary } }));
          cache.set(key, list);
        }
        if (list.length < (def.min || 4)) { sec.remove(); return; }
        // 15 affiches puis une tuile « Voir plus » qui ouvre toute la sélection.
        const more = el("button", "lumo-poster lumo-poster--more",
          `<span class="lumo-poster__img"><span class="lumo-more"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><span>Voir plus</span></span></span>`);
        more.type = "button";
        more.setAttribute("aria-label", `Voir tout : ${def.label}`);
        more.addEventListener("click", () => (def.more ? def.more() : openSheet(def)));
        track.replaceChildren(...list.slice(0, 15).map(posterCard), more);
        update();
      } catch (e) {
        console.warn(LOG, "rangée", def.label, e);
        sec.remove();
      }
    };
    container.appendChild(sec);
    if (lazy) lazy.observe(sec); else sec._load();
  }

  const HOME_GENRES = ["Action", "Aventure", "Comédie", "Fantastique", "Science-fiction", "Horreur", "Thriller", "Animation", "Drame", "Crime"];

  /* « Ajouts récents » par bibliothèque, via l'endpoint natif Items/Latest :
     les épisodes sont regroupés par série (une tuile = une série). */
  async function recentRows(container) {
    let views = [];
    try { views = (await getJSON(`UserViews`, { userId: uid() })).Items || []; } catch (e) { console.warn(LOG, e); return; }
    views = views.filter((v) => !["boxsets", "playlists", "music", "books", "livetv", "musicvideos", "homevideos", "photos"].includes(v.CollectionType));
    for (const v of views) {
      const route = v.CollectionType === "movies" ? `#/movies?topParentId=${v.Id}&collectionType=movies`
        : v.CollectionType === "tvshows" ? `#/tv?topParentId=${v.Id}&collectionType=tvshows`
          : `#/list?parentId=${v.Id}&serverId=${api().serverId()}`;
      posterRow(container, {
        label: `Ajouts récents · ${v.Name}`,
        key: `recent.${uid()}.${v.Id}`,
        ttl: 5 * 60 * 1000,
        min: 1,
        fetch: async () => {
          const list = await getJSON("Items/Latest", {
            userId: uid(), ParentId: v.Id, Limit: 30, GroupItems: true,
            Fields: "ProductionYear", ImageTypeLimit: 1, EnableImageTypes: "Primary"
          });
          const seen = new Set();
          const out = [];
          for (const it of list || []) {
            // Un épisode ou une saison isolés sont remplacés par leur série.
            const series = (it.Type === "Episode" || it.Type === "Season") && it.SeriesId;
            const item = series
              ? { Id: it.SeriesId, Name: it.SeriesName, ProductionYear: null, ImageTags: { Primary: it.SeriesPrimaryImageTag } }
              : it;
            if (seen.has(item.Id) || !item.ImageTags || !item.ImageTags.Primary) continue;
            seen.add(item.Id);
            out.push(item);
            if (out.length === 15) break;
          }
          return out;
        },
        more: () => { window.location.hash = route; }
      });
    }
  }

  async function mountRows(container, studios) {
    await recentRows(container);
    let groups = [];
    try { groups = await genreGroups(); } catch (e) { console.warn(LOG, "genres indisponibles", e); }
    if (!container.isConnected) return;
    HOME_GENRES.map((label) => groups.find((g) => g.label === label)).filter(Boolean).slice(0, 10)
      .forEach((g) => posterRow(container, { label: g.label, param: "GenreIds", ids: g.ids }));
    (studios || []).filter((s) => s.kind === "studio" && s.count >= 8)
      .sort((a, b) => b.count - a.count).slice(0, 8)
      .forEach((s) => posterRow(container, Object.assign({}, s, { param: "StudioIds" })));
  }

  /* ───────── panneaux superposés (studio, dé) ───────── */

  let activeLayer = null;
  function openLayer(cls, label) {
    closeLayer();
    const lastFocus = document.activeElement;
    const layer = el("div", "lumo-layer " + cls);
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", label);
    layer.innerHTML = `<div class="lumo-layer__scrim" data-close></div><div class="lumo-layer__panel" tabindex="-1"></div>`;
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); closeLayer(); return; }
      if (e.key !== "Tab") return;
      const f = [...layer.querySelectorAll("button,[href],input,select,[tabindex]:not([tabindex='-1'])")].filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    };
    layer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeLayer(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(layer);
    document.documentElement.classList.add("lumo-layer-open");
    requestAnimationFrame(() => layer.classList.add("is-open"));
    activeLayer = { layer, onKey, lastFocus };
    return layer.querySelector(".lumo-layer__panel");
  }
  function closeLayer() {
    if (!activeLayer) return;
    const { layer, onKey, lastFocus } = activeLayer;
    activeLayer = null;
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.classList.remove("lumo-layer-open");
    layer.classList.remove("is-open");
    setTimeout(() => layer.remove(), 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.addEventListener("hashchange", closeLayer);

  /* ───────── fiche studio ───────── */

  function posterCard(it) {
    const p = posterOf(it, 420);
    const a = el("a", "lumo-poster");
    a.href = `#/details?id=${it.Id}&serverId=${api().serverId()}`;
    a.title = it.Name;
    a.innerHTML = `<span class="lumo-poster__img">${p ? `<img src="${p}" alt="" loading="lazy" decoding="async">` : `<span class="lumo-poster__fallback">${esc(it.Name)}</span>`}</span>
      <span class="lumo-poster__name">${esc(it.Name)}</span><span class="lumo-poster__year">${esc(it.ProductionYear || "")}</span>`;
    return a;
  }

  /* Fiche « tout voir » d'un studio, d'une plateforme ou d'un genre :
     tous les titres correspondants, même répartis sur plusieurs studios. */
  async function openSheet(s) {
    const panel = openLayer("lumo-layer--studio", s.label);
    const colors = s.colors || ["#2a2a30", "#0e0e10"];
    panel.style.setProperty("--a", colors[0]);
    panel.style.setProperty("--b", colors[1]);
    if (s.count == null) {
      try {
        const r = await items({ [s.param]: s.ids.join(","), IncludeItemTypes: "Movie,Series", Limit: 0, EnableTotalRecordCount: true });
        s = Object.assign({}, s, { count: r.TotalRecordCount || 0 });
      } catch { s = Object.assign({}, s, { count: 0 }); }
    }
    panel.innerHTML = `
      <button type="button" class="lumo-round lumo-layer__close" data-close aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <header class="lumo-studio-head">
        <div class="lumo-studio-head__bg"></div>
        <div class="lumo-studio-head__body">
          ${s.logo ? `<img class="lumo-studio-head__logo" src="${BASE}assets/logos/${s.logo}" alt="${esc(s.label)}">` : `<h2>${esc(s.label)}</h2>`}
          <p class="lumo-studio-head__count">${s.count} titre${s.count > 1 ? "s" : ""}</p>
          <div class="lumo-seg" role="radiogroup" aria-label="Trier">
            <button type="button" role="radio" aria-checked="true" data-sort="PremiereDate,SortName" data-order="Descending">Récents</button>
            <button type="button" role="radio" aria-checked="false" data-sort="SortName" data-order="Ascending">A–Z</button>
            <button type="button" role="radio" aria-checked="false" data-sort="CommunityRating,SortName" data-order="Descending">Mieux notés</button>
          </div>
        </div>
      </header>
      <div class="lumo-grid" aria-live="polite"></div>`;
    panel.focus();
    const headLogo = panel.querySelector(".lumo-studio-head__logo");
    if (headLogo) headLogo.addEventListener("error", () => headLogo.replaceWith(Object.assign(document.createElement("h2"), { textContent: s.label })));
    const grid = panel.querySelector(".lumo-grid");

    const load = async (sortBy, order) => {
      grid.classList.add("is-loading");
      try {
        const res = await items({
          [s.param]: s.ids.join(","), IncludeItemTypes: "Movie,Series",
          SortBy: sortBy, SortOrder: order, Fields: "ProductionYear,ImageTags,BackdropImageTags", Limit: 500
        });
        const list = res.Items || [];
        grid.replaceChildren(...list.map(posterCard));
        const withBackdrop = list.filter((x) => x.BackdropImageTags && x.BackdropImageTags.length);
        const bgItem = withBackdrop.length ? shuffle(withBackdrop)[0] : null;
        const bg = panel.querySelector(".lumo-studio-head__bg");
        if (bgItem && !bg.style.backgroundImage) {
          const url = backdropOf(bgItem, 1600);
          await preload(url);
          bg.style.backgroundImage = `url("${url}")`;
          bg.classList.add("is-on");
        }
      } catch (e) {
        grid.innerHTML = `<p class="lumo-empty">Impossible de charger cette sélection.</p>`;
        console.warn(LOG, e);
      } finally {
        grid.classList.remove("is-loading");
      }
    };
    panel.querySelector(".lumo-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sort]");
      if (!b) return;
      panel.querySelectorAll(".lumo-seg button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      load(b.dataset.sort, b.dataset.order);
    });
    grid.addEventListener("click", (e) => { if (e.target.closest("a.lumo-poster")) closeLayer(); });
    load("PremiereDate,SortName", "Descending");
  }

  /* ───────── dé + roulette ───────── */

  const DIE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></svg>`;

  /* Le dé se place juste avant la loupe de l'en-tête visible : barre React/MUI
     de Jellyfin 12 (lien #/search) ou en-tête historique (mode TV). On copie
     les classes de la loupe pour obtenir exactement le même bouton. */
  function visible(n) { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function ensureDice() {
    const search = [...document.querySelectorAll('a[href="#/search"], .headerSearchButton')].find(visible);
    if (!search || !search.parentElement) return;
    if (search.parentElement.querySelector(":scope > .lumo-dice-btn")) return;
    document.querySelectorAll(".lumo-dice-btn").forEach((n) => n.remove());
    const b = el("button", `${search.className} lumo-dice-btn`, DIE_SVG);
    b.type = "button";
    b.title = "Choisir au hasard";
    b.setAttribute("aria-label", "Choisir un titre au hasard");
    b.addEventListener("click", openDice);
    search.parentElement.insertBefore(b, search);
  }

  async function genreGroups() {
    const key = "genres." + uid();
    const cached = cache.get(key, 6 * 60 * 60 * 1000);
    if (cached) return cached;
    const res = await getJSON("Genres", { userId: uid(), Recursive: true, IncludeItemTypes: "Movie,Series" });
    const byName = new Map((res.Items || []).map((g) => [norm(g.Name), g.Id]));
    const groups = GENRES.map(([label, aliases]) => ({
      label, ids: [...new Set(aliases.map((a) => byName.get(norm(a))).filter(Boolean))]
    })).filter((g) => g.ids.length);
    cache.set(key, groups);
    return groups;
  }

  const dice = { genre: null, type: "Movie", unseen: false, spinning: false };

  async function openDice() {
    if (!api()) return;
    const panel = openLayer("lumo-layer--dice", "Choisir au hasard");
    panel.innerHTML = `
      <button type="button" class="lumo-round lumo-layer__close" data-close aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="lumo-dice">
        <div class="lumo-dice__head">
          <span class="lumo-dice__icon">${DIE_SVG}</span>
          <div><h2>On regarde quoi ?</h2><p>Choisis un genre, la roulette s'occupe du reste.</p></div>
        </div>
        <div class="lumo-seg lumo-dice__type" role="radiogroup" aria-label="Type">
          <button type="button" role="radio" data-type="Movie">Films</button>
          <button type="button" role="radio" data-type="Series">Séries</button>
          <button type="button" role="radio" data-type="Movie,Series">Les deux</button>
        </div>
        <div class="lumo-chips" role="radiogroup" aria-label="Genre"><span class="lumo-chips__loading">Chargement des genres…</span></div>
        <label class="lumo-check"><input type="checkbox" class="lumo-dice__unseen"><span>Seulement ce que je n'ai pas vu</span></label>
        <div class="lumo-wheel" hidden>
          <div class="lumo-wheel__window"><div class="lumo-wheel__strip"></div></div>
          <div class="lumo-wheel__marker" aria-hidden="true"></div>
        </div>
        <div class="lumo-pick" hidden aria-live="polite"></div>
        <div class="lumo-dice__foot">
          <button type="button" class="lumo-btn lumo-btn--primary lumo-dice__go">${DIE_SVG}<span>Lancer</span></button>
        </div>
      </div>`;
    panel.focus();

    const typeSeg = panel.querySelector(".lumo-dice__type");
    const syncType = () => typeSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === dice.type)));
    syncType();
    typeSeg.addEventListener("click", (e) => { const b = e.target.closest("button[data-type]"); if (b) { dice.type = b.dataset.type; syncType(); } });

    const unseen = panel.querySelector(".lumo-dice__unseen");
    unseen.checked = dice.unseen;
    unseen.addEventListener("change", () => { dice.unseen = unseen.checked; });

    const chips = panel.querySelector(".lumo-chips");
    try {
      const groups = await genreGroups();
      chips.innerHTML = [`<button type="button" role="radio" data-g="">Tous</button>`]
        .concat(groups.map((g, k) => `<button type="button" role="radio" data-g="${k}">${esc(g.label)}</button>`)).join("");
      const syncChips = () => chips.querySelectorAll("button").forEach((b) => {
        const on = b.dataset.g === "" ? !dice.genre : dice.genre && groups[b.dataset.g]?.label === dice.genre.label;
        b.setAttribute("aria-checked", String(Boolean(on)));
      });
      syncChips();
      chips.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-g]");
        if (!b) return;
        dice.genre = b.dataset.g === "" ? null : groups[b.dataset.g];
        syncChips();
      });
    } catch (e) {
      chips.innerHTML = `<span class="lumo-chips__loading">Genres indisponibles : tirage sur toute la bibliothèque.</span>`;
    }

    panel.querySelector(".lumo-dice__go").addEventListener("click", () => spin(panel));
  }

  async function spin(panel) {
    if (dice.spinning) return;
    dice.spinning = true;
    const go = panel.querySelector(".lumo-dice__go");
    go.disabled = true;
    const pick = panel.querySelector(".lumo-pick");
    pick.hidden = true;
    const wheel = panel.querySelector(".lumo-wheel");
    const strip = panel.querySelector(".lumo-wheel__strip");

    try {
      const histKey = "dice.history." + uid();
      const history = store.get(histKey, []);
      const query = {
        IncludeItemTypes: dice.type, SortBy: "Random", Limit: 80, ImageTypes: "Primary",
        Fields: FIELDS, EnableUserData: true
      };
      if (dice.genre) query.GenreIds = dice.genre.ids.join(",");
      if (dice.unseen) query.IsPlayed = false;
      const res = await items(query);
      let pool = (res.Items || []).filter((it) => it.ImageTags && it.ImageTags.Primary);
      if (!pool.length) {
        pick.hidden = false;
        pick.innerHTML = `<p class="lumo-empty">Rien à tirer avec ces critères.</p>`;
        return;
      }
      // « Toujours différent » : on écarte les derniers tirages.
      let fresh = pool.filter((it) => !history.includes(it.Id));
      if (!fresh.length) {
        const keep = new Set(pool.map((it) => it.Id));
        store.set(histKey, history.filter((id) => !keep.has(id)));
        fresh = pool.filter((it) => it.Id !== history[history.length - 1]);
        if (!fresh.length) fresh = pool;
      }
      const winner = shuffle(fresh)[0];
      store.set(histKey, store.get(histKey, []).filter((id) => id !== winner.Id).concat(winner.Id).slice(-CONFIG.diceHistory));

      // Bande de la roulette : remplissage aléatoire, gagnant vers la fin.
      const filler = shuffle(pool.filter((it) => it.Id !== winner.Id));
      const N = 44, W = 36;
      const tiles = [];
      for (let k = 0; k < N; k++) tiles.push(k === W ? winner : filler.length ? filler[k % filler.length] : winner);
      strip.style.transition = "none";
      strip.innerHTML = tiles.map((it, k) => `<div class="lumo-wheel__tile${k === W ? " is-winner" : ""}"><img src="${posterOf(it, 300)}" alt="" decoding="async"></div>`).join("");
      wheel.hidden = false;
      wheel.classList.remove("is-done");
      const windowEl = wheel.querySelector(".lumo-wheel__window");
      const center = windowEl.clientWidth / 2;
      // La bande démarre déjà remplie (3e affiche au centre), jamais à moitié vide.
      const start = strip.children[2];
      strip.style.transform = `translate3d(${-(start.offsetLeft + start.offsetWidth / 2 - center)}px,0,0)`;

      // Les affiches autour du gagnant chargent pendant la rotation ; on n'attend pas plus de 400 ms.
      await Promise.race([
        Promise.all(tiles.slice(W - 4, W + 3).map((it) => preload(posterOf(it, 300)))),
        new Promise((r) => setTimeout(r, 400))
      ]);
      const tile = strip.children[W];
      const jitter = (Math.random() - 0.5) * tile.offsetWidth * 0.6;
      const target = tile.offsetLeft + tile.offsetWidth / 2 - center + jitter;
      const duration = reducedMotion() ? 300 : 5200;

      void strip.offsetWidth;
      strip.style.transition = `transform ${duration}ms cubic-bezier(.08,.6,.12,1)`;
      strip.style.transform = `translate3d(${-target}px,0,0)`;
      await new Promise((r) => setTimeout(r, duration + 60));

      // Recentrage doux sur le gagnant
      strip.style.transition = "transform 380ms cubic-bezier(.3,.7,.2,1)";
      strip.style.transform = `translate3d(${-(target - jitter)}px,0,0)`;
      await new Promise((r) => setTimeout(r, 400));
      wheel.classList.add("is-done");
      showPick(pick, winner);
    } catch (e) {
      console.warn(LOG, "roulette", e);
      pick.hidden = false;
      pick.innerHTML = `<p class="lumo-empty">Le tirage a échoué. Réessaie.</p>`;
    } finally {
      dice.spinning = false;
      go.disabled = false;
      go.querySelector("span").textContent = "Relancer";
    }
  }

  function showPick(pick, it) {
    pick.hidden = false;
    pick.innerHTML = `
      <img class="lumo-pick__poster" src="${posterOf(it, 360)}" alt="">
      <div class="lumo-pick__body">
        <h3>${esc(it.Name)}</h3>
        <div class="lumo-hero__meta">${metaChips(it)}</div>
        <p>${esc(it.Overview || "")}</p>
        <div class="lumo-hero__actions">
          <button type="button" class="lumo-btn lumo-btn--primary" data-act="play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span>Lecture</span></button>
          <button type="button" class="lumo-btn" data-act="info"><span>Voir la fiche</span></button>
        </div>
      </div>`;
    pick.querySelector('[data-act="play"]').addEventListener("click", () => { closeLayer(); play(it); });
    pick.querySelector('[data-act="info"]').addEventListener("click", () => { closeLayer(); goDetails(it.Id); });
  }

  /* ───────── montage selon la page ───────── */

  function homeTab() {
    const page = $("#indexPage:not(.hide)");
    return page ? $("#homeTab", page) : null;
  }

  function syncHome() {
    const tab = homeTab();
    if (!tab || tab.offsetParent === null) return;
    if (tab.querySelector(":scope > .lumo-home")) return;
    // Haut de page : hero puis rails. Bas de page (après les sections
    // natives / Home Screen Sections) : rangées par genre et par studio.
    const wrap = el("div", "lumo-home");
    const rails = el("div", "lumo-rails");
    const rows = el("div", "lumo-rows");
    tab.insertBefore(wrap, tab.firstChild);
    tab.appendChild(rows);
    // Le hero passe sous l'en-tête transparent : on mesure sa hauteur réelle.
    const top = tab.getBoundingClientRect().top + window.scrollY;
    document.documentElement.style.setProperty("--lumo-hero-pull", `${Math.max(0, Math.round(top))}px`);
    mountHero(wrap).catch((e) => console.warn(LOG, e));
    wrap.appendChild(rails);
    mountRails(rails)
      .then((studios) => mountRows(rows, studios))
      .catch((e) => console.warn(LOG, e));
  }

  function syncRoute() {
    const onHome = Boolean(homeTab());
    document.documentElement.classList.toggle("lumo-on-home", onHome);
  }

  let queued = false;
  function sync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!api()) return;
      try { ensureDice(); } catch (e) { console.warn(LOG, e); }
      try { syncRoute(); syncHome(); } catch (e) { console.warn(LOG, e); }
    });
  }

  document.addEventListener("viewshow", () => setTimeout(sync, 0), true);
  window.addEventListener("hashchange", () => setTimeout(sync, 50));
  window.addEventListener("pageshow", sync);

  // Démarrage : ApiClient et l'en-tête arrivent après ce script.
  let tries = 0;
  (function boot() {
    sync();
    if (++tries < 40 && (!api() || !$(".lumo-dice-btn"))) setTimeout(boot, 250);
  })();
})();
