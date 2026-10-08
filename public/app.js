/* Портфолио: проекты, версии названия, цели/задачи, ссылки, фото, предпросмотр, тема */
const STORE_KEY = 'portfolio-projects-v1';
const THEME_KEY = 'portfolio-theme';
const CATEGORIES = { all: 'Все', site: 'Сайт', game: 'Игра', education: 'Обучение', other: 'Другое' };
const LINK_TYPES = {
  github: { label: 'GitHub', icon: 'icons/link-github.png' },
  site: { label: 'Сайт', icon: 'icons/link-site.png' },
  project: { label: 'Проект', icon: 'icons/link-project.png' },
};
const DEFAULT_ICON = 'icons/category-other.png';
// Старые эмодзи-иконки проектов переводим в картинки
const EMOJI_TO_IMAGE = {
  '🚀': 'icons/icon-rocket.png', '📁': DEFAULT_ICON, '🎮': 'icons/category-game.png',
  '📚': 'icons/category-education.png', '🎨': 'icons/icon-design.png', '💡': 'icons/icon-ai.png',
  '🧩': 'icons/icon-tools.png', '🛒': 'icons/icon-shop.png', '📱': 'icons/icon-mobile.png',
  '🌿': 'icons/icon-data.png', '🧠': 'icons/icon-ai.png', '🎵': 'icons/icon-music.png',
  '🤖': 'icons/icon-ai.png', '📷': 'icons/icon-design.png',
};

const state = {
  projects: [],
  activeId: null,
  filter: 'all',
  showHistory: false,
  showIcon: false,
  showLinkForm: false,
  previewId: null,
  tab: 'projects',
  descLoading: false,
  descError: '',
  ai: { apiKey: '', text: '', targetId: 'new', model: 'openai/gpt-oss-120b', loading: false, error: '', result: null },
  draft: { goal: '', task: '', linkUrl: '', linkLabel: '', linkType: 'site' },
};

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const bump = (v) => { const [a, b] = v.split('.').map(Number); return `${a}.${b + 1}`; };
const active = () => state.projects.find((p) => p.id === state.activeId) || null;
const isImg = (s) => typeof s === 'string' && (s.startsWith('data:') || s.startsWith('icons/'));
const CATEGORY_ICONS = [
  'icons/category-site.png', 'icons/category-game.png', 'icons/category-education.png', 'icons/category-other.png',
  'icons/icon-mobile.png', 'icons/icon-design.png', 'icons/icon-data.png', 'icons/icon-ai.png',
  'icons/icon-music.png', 'icons/icon-shop.png', 'icons/icon-rocket.png', 'icons/icon-tools.png',
];
const iconHtml = (icon, cls) => isImg(icon)
  ? `<img class="${cls}" src="${icon}" alt="">`
  : `<img class="${cls}" src="${DEFAULT_ICON}" alt="">`;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
function setThemeButton(el) {
  el.innerHTML = isDark()
    ? '<img class="ico" src="icons/theme-sun.png" alt=""> Светлая тема'
    : '<img class="ico" src="icons/theme-moon.png" alt=""> Тёмная тема';
}

/* ---------- данные ---------- */
function seed() {
  const t = now();
  return {
    id: uid(), title: 'Мой первый проект', version: '1.1', category: 'site', icon: 'icons/icon-rocket.png',
    description: 'Здесь коротко описываю, что это за проект и зачем он нужен.',
    goals: [{ id: uid(), text: 'Собрать все проекты в одном месте' }],
    tasks: [{ id: uid(), text: 'Добавить ссылку на GitHub', done: true }, { id: uid(), text: 'Добавить сайт', done: false }],
    links: [{ id: uid(), type: 'github', label: 'GitHub', url: 'https://github.com/Evil-Pinguin/portfolio' }],
    images: [],
    history: [
      { version: '1.1', title: 'Мой первый проект', date: t },
      { version: '1.0', title: 'Новый проект', date: t },
    ],
    created: t, updated: t,
  };
}
function newProject() {
  const t = now();
  return {
    id: uid(), title: 'Новый проект', version: '1.0', category: 'other', icon: DEFAULT_ICON,
    description: '', goals: [], tasks: [], links: [], images: [],
    history: [{ version: '1.0', title: 'Новый проект', date: t }], created: t, updated: t,
  };
}
// Старые проекты с одним изображением переводим в список фото
function migrate(p) {
  if (!isImg(p.icon)) p.icon = EMOJI_TO_IMAGE[p.icon] || DEFAULT_ICON;
  if (!Array.isArray(p.images)) p.images = p.image ? [{ id: uid(), src: p.image }] : [];
  delete p.image;
  return p;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state.projects = raw ? JSON.parse(raw).map(migrate) : [seed()];
  } catch (e) { state.projects = [seed()]; }
  state.activeId = state.projects[0]?.id ?? null;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.projects)); }
  catch (e) { alert('Не хватает места в хранилище браузера. Удалите часть фото или используйте файлы меньшего размера.'); }
}

/* ---------- отрисовка ---------- */
const UI_KEY = 'portfolio-ui';
function persistUI() {
  const a = state.ai;
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({
      tab: state.tab, activeId: state.activeId, filter: state.filter, previewId: state.previewId,
      ai: { text: a.text, targetId: a.targetId, model: a.model, result: a.result },
    }));
  } catch (e) {}
}
function restoreUI() {
  try {
    const u = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    if (!u) return;
    if (['projects', 'ai'].includes(u.tab)) state.tab = u.tab;
    if (u.filter && CATEGORIES[u.filter]) state.filter = u.filter;
    if (state.projects.some((p) => p.id === u.activeId)) state.activeId = u.activeId;
    state.previewId = u.previewId || null;
    if (u.ai) {
      state.ai.text = u.ai.text || '';
      state.ai.model = u.ai.model || state.ai.model;
      state.ai.targetId = (u.ai.targetId === 'new' || state.projects.some((p) => p.id === u.ai.targetId)) ? u.ai.targetId : 'new';
      state.ai.result = u.ai.result || null;
    }
  } catch (e) {}
}

function render(focusSel) {
  persistUI();
  syncTabs();
  if (state.tab === 'ai') { renderAI(); document.querySelectorAll('textarea').forEach(autosize); return; }
  renderSidebar();
  renderMain();
  document.querySelectorAll('textarea').forEach(autosize);
  if (focusSel) { const el = document.querySelector(focusSel); if (el) el.focus(); }
}

function renderSidebar() {
  const list = state.projects.filter((p) => state.filter === 'all' || p.category === state.filter);
  $('#sidebar').innerHTML = `
    <div class="side-head">Проекты <span class="counter">${state.projects.length}</span></div>
    <div class="chips">${Object.entries(CATEGORIES).map(([k, v]) =>
      `<button class="chip ${state.filter === k ? 'on' : ''}" data-action="filter" data-cat="${k}">${v}</button>`).join('')}</div>
    <nav class="plist">${list.length ? list.map((p) => `
      <button class="pitem ${p.id === state.activeId ? 'on' : ''}" data-action="select" data-id="${p.id}">
        ${iconHtml(p.icon, 'pi-icon')}
        <span class="pi-text">
          <span class="pi-title">${esc(p.title || 'Без названия')}</span>
          <span class="pi-meta">${CATEGORIES[p.category]} · v${p.version}</span>
        </span>
      </button>`).join('') : '<p class="empty-note">Проектов пока нет</p>'}
    </nav>`;
}

function box(title, headExtra, body) {
  return `<section class="box">
    <div class="box-head"><h2 class="box-title">${title}</h2>${headExtra || ''}</div>
    ${body}
  </section>`;
}

function historyHtml(p) {
  return `<div class="history" id="historyBox">${p.history.map((h, i) => `
    <div class="hrow">
      <span class="ver-tag">v${h.version}</span>
      <span class="hr-title">${esc(h.title)}</span>
      <span class="muted small">${fmtDate(h.date)}</span>
      ${i === 0 ? '<span class="muted small">текущая</span>'
        : `<button class="btn btn-small" data-action="restore" data-idx="${i}">Вернуть</button>`}
    </div>`).join('')}</div>`;
}

function renderMain() {
  const main = $('#main');
  const p = active();
  if (!p) {
    main.innerHTML = `<div class="empty">
      <h1>Все ваши проекты — в одном месте</h1>
      <p>Создайте проект: название с историей версий, описание, цели и задачи, ссылки на GitHub и сайт, фото и предпросмотр.</p>
      <button class="btn btn-primary" data-action="new">+ Новый проект</button></div>`;
    return;
  }
  const d = state.draft;
  const doneCount = p.tasks.filter((t) => t.done).length;
  const siteLinks = p.links.filter((l) => l.type === 'site');
  const preview = siteLinks.find((l) => l.id === state.previewId) || siteLinks[0];

  const goalsBox = box('Цели', `<span class="counter">${p.goals.length}</span>`, `
    <ul class="list">${p.goals.map((g) => `
      <li class="row"><span class="dot"></span><span class="row-text">${esc(g.text)}</span>
        <button class="x" data-action="delItem" data-kind="goals" data-id="${g.id}" title="Удалить">×</button></li>`).join('')}</ul>
    <div class="add-row">
      <input data-draft="goal" value="${esc(d.goal)}" placeholder="Новая цель">
      <button class="btn btn-small" data-action="addItem" data-kind="goals">Добавить</button>
    </div>`);

  const tasksBox = box('Задачи', `<span class="counter">${doneCount}/${p.tasks.length}</span>`, `
    <ul class="list">${p.tasks.map((t) => `
      <li class="row ${t.done ? 'done' : ''}">
        <button class="check" data-action="toggleTask" data-id="${t.id}" aria-label="Отметить">${t.done ? '<svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</button>
        <span class="row-text">${esc(t.text)}</span>
        <button class="x" data-action="delItem" data-kind="tasks" data-id="${t.id}" title="Удалить">×</button></li>`).join('')}</ul>
    <div class="add-row">
      <input data-draft="task" value="${esc(d.task)}" placeholder="Новая задача">
      <button class="btn btn-small" data-action="addItem" data-kind="tasks">Добавить</button>
    </div>`);

  const linksBody = `
    ${state.showLinkForm ? `<div class="linkform">
        <div class="chips">${Object.entries(LINK_TYPES).map(([k, v]) =>
          `<button class="chip ${d.linkType === k ? 'on' : ''}" data-action="setLinkType" data-type="${k}"><img class="ico" src="${v.icon}" alt=""> ${v.label}</button>`).join('')}</div>
        <input data-draft="linkUrl" value="${esc(d.linkUrl)}" placeholder="Ссылка, например https://github.com/...">
        <div class="line">
          <input data-draft="linkLabel" value="${esc(d.linkLabel)}" placeholder="Подпись (необязательно)">
          <button class="btn btn-primary" data-action="addLink">Добавить</button>
        </div>
      </div>` : ''}
    <div class="links">${p.links.length ? p.links.map((l) => `
      <div class="link-row">
        <img class="li-icon" src="${LINK_TYPES[l.type].icon}" alt="">
        <div class="li-text">
          <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>
          <span class="muted small">${LINK_TYPES[l.type].label} · ${esc(l.url)}</span>
        </div>
        <button class="x" data-action="delLink" data-id="${l.id}" title="Удалить">×</button>
      </div>`).join('') : '<p class="box-empty">Ссылок пока нет — нажмите +</p>'}</div>`;
  const linksBox = box('Ссылки',
    `<button class="btn btn-small ${state.showLinkForm ? '' : ''}" data-action="toggleLinkForm">${state.showLinkForm ? 'Закрыть' : '+ Добавить'}</button>`,
    linksBody);

  const galleryBox = box('Фото', `<button class="btn btn-small" data-action="uploadImage">+ Добавить фото</button>`, `
    <div class="box-body"><div class="gallery">
      ${p.images.map((im) => `
        <figure class="tile"><img src="${im.src}" alt="">
          <button class="tile-x" data-action="delImage" data-id="${im.id}" title="Удалить фото">×</button></figure>`).join('')}
      <button class="tile tile-add" data-action="uploadImage">+ Фото</button>
    </div></div>`);

  const previewBox = box('Предпросмотр сайта',
    siteLinks.length > 1 ? `<select id="previewSelect" class="btn">${siteLinks.map((l) =>
      `<option value="${l.id}" ${l.id === preview.id ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>` : '',
    preview
      ? `<iframe class="preview-frame" src="${esc(preview.url)}" title="Предпросмотр"></iframe>
         <div class="preview-foot">Не открывается? <a href="${esc(preview.url)}" target="_blank" rel="noopener">Открыть в новой вкладке</a></div>`
      : '<p class="box-empty">Добавьте ссылку типа «Сайт» — и здесь появится предпросмотр.</p>');

  main.innerHTML = `
    <div class="topbar">
      <div class="chips">${Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([k, v]) =>
        `<button class="chip ${p.category === k ? 'on' : ''}" data-action="setCat" data-cat="${k}">${v}</button>`).join('')}</div>
      <button class="btn btn-link btn-danger" data-action="delete">Удалить проект</button>
    </div>

    <header class="proj-head">
      <button class="icon-btn" data-action="toggleIcon" title="Сменить иконку">${iconHtml(p.icon, 'big-icon')}</button>
      <div class="proj-head-text">
        <input class="title" data-field="title" value="${esc(p.title)}" maxlength="120" aria-label="Название проекта">
        <div class="verrow">
          <button class="ver" data-action="toggleHistory" title="История версий">v${p.version}</button>
          <span class="muted small">Обновлено ${fmtDate(p.updated)}</span>
        </div>
      </div>
    </header>
    ${state.showIcon ? `<div class="popover">
        <div class="icon-choices">${CATEGORY_ICONS.map((src) => `<button class="icon-choice" data-action="setIcon" data-icon="${src}"><img src="${src}" alt=""></button>`).join('')}</div>
        <button class="btn btn-small" data-action="uploadIcon">Загрузить свою картинку</button>
      </div>` : ''}
    ${state.showHistory ? historyHtml(p) : ''}
    <div class="desc-tools">
      <button class="btn btn-small" data-action="genDesc" ${state.descLoading ? 'disabled' : ''}>${state.descLoading ? 'Пишу описание…' : '<img class="ico" src="icons/ai-sparkle.png" alt=""> Сгенерировать описание'}</button>
      ${state.descError ? `<span class="ai-error">${esc(state.descError)}</span>` : '<span class="muted small">ИИ напишет описание по названию, целям и задачам</span>'}
    </div>
    <textarea class="desc" data-field="description" rows="2" placeholder="Коротко о проекте: что это и зачем">${esc(p.description)}</textarea>

    <div class="grid2">${goalsBox}${tasksBox}</div>

    <div class="stack" style="margin-top:24px">
      ${linksBox}
      ${galleryBox}
      ${previewBox}
    </div>`;
}

function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

/* Обновляет заголовок в сайдбаре, версию и историю без пересоздания поля ввода */
function syncTitleUI(p) {
  const item = document.querySelector(`.pitem[data-id="${p.id}"]`);
  if (item) {
    item.querySelector('.pi-title').textContent = p.title || 'Без названия';
    item.querySelector('.pi-meta').textContent = `${CATEGORIES[p.category]} · v${p.version}`;
  }
  const ver = document.querySelector('.ver');
  if (ver) ver.textContent = 'v' + p.version;
  const input = document.querySelector('[data-field="title"]');
  if (input && input.value !== p.title) input.value = p.title;
  const box = document.getElementById('historyBox');
  if (box) box.outerHTML = historyHtml(p);
}

/* ---------- действия ---------- */
// Текст сохраняется сразу при вводе; версия поднимается, когда название реально изменилось
function commitTitle(p, raw, force = false) {
  let t = raw.trim().slice(0, 120);
  if (!t) t = p.history[0].title; // пустое название — возвращаем последнее
  p.title = t;
  if (t === p.history[0].title && !force) { save(); syncTitleUI(p); return; }
  p.version = bump(p.version);
  p.history.unshift({ version: p.version, title: t, date: now() });
  p.updated = now();
  save();
  syncTitleUI(p);
}

function addItem(kind) {
  const p = active(); if (!p) return;
  const key = kind === 'goals' ? 'goal' : 'task';
  const text = state.draft[key].trim();
  if (!text) return;
  p[kind].push(kind === 'goals' ? { id: uid(), text } : { id: uid(), text, done: false });
  state.draft[key] = '';
  p.updated = now(); save();
  render(`[data-draft="${key}"]`);
}

function addLink() {
  const p = active(); if (!p) return;
  const d = state.draft;
  let url = d.linkUrl.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const type = d.linkType;
  p.links.push({ id: uid(), type, label: d.linkLabel.trim() || LINK_TYPES[type].label, url });
  d.linkUrl = ''; d.linkLabel = '';
  state.showLinkForm = false;
  p.updated = now(); save();
  render();
}

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const p = active();
  switch (el.dataset.action) {
    case 'tab': setTab(el.dataset.tab); break;
    case 'saveKey':
      state.ai.apiKey = cleanKey(state.ai.apiKey);
      try { localStorage.setItem(GROQ_KEY, state.ai.apiKey); } catch (err) {}
      state.ai.error = ''; render(); break;
    case 'aiGenerate': aiGenerate(); break;
    case 'genDesc': genDesc(); break;
    case 'aiApply': applyEmployerText(); break;
    case 'aiCopy': {
      const txt = state.ai.result?.employerText || '';
      navigator.clipboard?.writeText(txt).then(() => { el.textContent = 'Скопировано'; }).catch(() => {});
      break;
    }
    case 'toggleTheme': {
      const dark = !isDark();
      if (dark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (err) {}
      setThemeButton(el);
      break;
    }
    case 'new': {
      const np = newProject();
      state.projects.unshift(np);
      state.activeId = np.id;
      state.showHistory = state.showIcon = state.showLinkForm = false;
      save(); render('.title');
      break;
    }
    case 'filter': state.filter = el.dataset.cat; renderSidebar(); break;
    case 'select':
      state.activeId = el.dataset.id;
      state.showHistory = state.showIcon = state.showLinkForm = false;
      render(); break;
    case 'setCat': p.category = el.dataset.cat; p.updated = now(); save(); render(); break;
    case 'delete':
      if (!confirm(`Удалить проект «${p.title}»?`)) break;
      state.projects = state.projects.filter((x) => x.id !== p.id);
      state.activeId = state.projects[0]?.id ?? null;
      save(); render(); break;
    case 'toggleIcon': state.showIcon = !state.showIcon; renderMain(); break;
    case 'setIcon': p.icon = el.dataset.icon; state.showIcon = false; p.updated = now(); save(); render(); break;
    case 'uploadIcon': $('#iconFile').click(); break;
    case 'toggleHistory': state.showHistory = !state.showHistory; renderMain(); break;
    case 'restore': commitTitle(p, p.history[+el.dataset.idx].title, true); render(); break;
    case 'toggleLinkForm': state.showLinkForm = !state.showLinkForm; renderMain(); break;
    case 'setLinkType': state.draft.linkType = el.dataset.type; renderMain(); break;
    case 'addLink': addLink(); break;
    case 'delLink': p.links = p.links.filter((l) => l.id !== el.dataset.id); p.updated = now(); save(); render(); break;
    case 'addItem': addItem(el.dataset.kind); break;
    case 'delItem':
      p[el.dataset.kind] = p[el.dataset.kind].filter((x) => x.id !== el.dataset.id);
      p.updated = now(); save(); render(); break;
    case 'toggleTask': {
      const t = p.tasks.find((x) => x.id === el.dataset.id);
      if (t) t.done = !t.done;
      p.updated = now(); save(); render(); break;
    }
    case 'uploadImage': $('#imageFile').click(); break;
    case 'delImage': p.images = p.images.filter((im) => im.id !== el.dataset.id); p.updated = now(); save(); render(); break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.ai === 'text') { state.ai.text = t.value; return; }
  if (t.dataset.ai === 'key') {
    state.ai.apiKey = cleanKey(t.value);
    try { localStorage.setItem(GROQ_KEY, state.ai.apiKey); } catch (err) {}
    return;
  }
  if (t.dataset.draft) { state.draft[t.dataset.draft] = t.value; return; }
  const p = active(); if (!p) return;
  if (t.dataset.field === 'title') {
    p.title = t.value.slice(0, 120);
    save();
    const item = document.querySelector(`.pitem[data-id="${p.id}"] .pi-title`);
    if (item) item.textContent = p.title || 'Без названия';
  } else if (t.dataset.field === 'description') {
    p.description = t.value; p.updated = now(); save(); autosize(t);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const t = e.target;
  if (t.dataset.field === 'title') { e.preventDefault(); t.blur(); }
  else if (t.dataset.draft === 'goal') { e.preventDefault(); addItem('goals'); }
  else if (t.dataset.draft === 'task') { e.preventDefault(); addItem('tasks'); }
  else if (t.dataset.draft === 'linkUrl' || t.dataset.draft === 'linkLabel') { e.preventDefault(); addLink(); }
});

// Когда поле названия теряет фокус, фиксируем новую версию (если название изменилось)
document.addEventListener('focusout', (e) => {
  if (e.target.dataset && e.target.dataset.field === 'title') {
    const p = active(); if (p) commitTitle(p, e.target.value);
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.ai === 'target') { state.ai.targetId = t.value; return; }
  if (t.dataset.ai === 'model') { state.ai.model = t.value; return; }
  const p = active();
  if (t.id === 'previewSelect') { state.previewId = t.value; renderMain(); return; }
  if (!p || !t.files || !t.files.length) return;
  const files = [...t.files];
  t.value = '';
  try {
    if (t.id === 'iconFile') {
      p.icon = await resizeImage(files[0], 256);
      state.showIcon = false;
    } else if (t.id === 'imageFile') {
      for (const f of files) p.images.push({ id: uid(), src: await resizeImage(f, 800) });
    }
    p.updated = now(); save(); render();
  } catch (err) {
    alert('Не удалось открыть изображение');
  }
});

/* ---------- Вкладки ---------- */
function syncTabs() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  document.querySelector('.app')?.classList.toggle('single', state.tab === 'ai');
}
function setTab(tab) {
  state.tab = tab;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Интеграция ИИ (Groq, OpenAI-совместимый API) ---------- */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = 'portfolio-groq-key';
const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'gpt-oss-120b — точнее (рекомендуется)' },
  { id: 'openai/gpt-oss-20b', label: 'gpt-oss-20b — быстрее и дешевле' },
];
const AI_CATEGORIES = ['site', 'game', 'education', 'other'];
const AI_SYSTEM = `Ты помогаешь составлять портфолио. Пользователь описывает ОДИН свой проект. Верни ТОЛЬКО JSON без пояснений и без markdown, в формате:
{"title":"короткое название проекта","category":"site|game|education|other","employer_text":"текст","goals":["цель"],"tasks":["задача"]}
Правила:
- employer_text: улучшенное описание для работодателей на русском, 3-5 предложений: что сделано, для кого, какие технологии, какой результат. Пиши уверенно и понятно, без канцелярита. Не выдумывай цифры и факты, которых нет в тексте пользователя.
- goals: 2-4 цели проекта, коротко.
- tasks: 3-6 конкретных задач, включая уже сделанное и то, что предстоит.
- category: site - сайт или веб-приложение, game - игра, education - обучение или курс, other - остальное.`;

function parseJsonLoose(text) {
  const clean = text.replace(/```(?:json)?/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('модель вернула ответ не в формате JSON');
  return JSON.parse(clean.slice(start, end + 1));
}
// Ключ API может содержать невидимые или не-латинские символы после копирования — оставляем только ASCII
const cleanKey = (v) => String(v || '').replace(/[^\x21-\x7E]/g, '');
const cleanList = (arr) => (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean);

// Добавляет только новые пункты, без дублей
function mergeItems(list, texts, kind) {
  const seen = new Set(list.map((x) => x.text.toLowerCase()));
  let added = 0;
  for (const t of texts) {
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    list.push(kind === 'goals' ? { id: uid(), text: t } : { id: uid(), text: t, done: false });
    added++;
  }
  return added;
}

async function groqChat(messages, maxTokens = 2000) {
  const key = cleanKey(state.ai.apiKey);
  if (!key) throw new Error('не задан ключ Groq (вкладка «Интеграция ИИ»)');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: state.ai.model, temperature: 0.5, max_completion_tokens: maxTokens, messages }),
  });
  if (!res.ok) throw new Error(`Groq ответил ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

const DESC_SYSTEM = `Напиши описание проекта для портфолио на русском языке: 3-5 предложений, понятно для работодателя. Используй только факты из данных пользователя, ничего не выдумывай. Верни только текст описания, без заголовков, списков и markdown.`;

async function genDesc() {
  const p = active(); if (!p) return;
  state.descLoading = true; state.descError = ''; render();
  try {
    const facts = [
      `Название: ${p.title}`,
      `Категория: ${CATEGORIES[p.category]}`,
      p.goals.length ? `Цели: ${p.goals.map((g) => g.text).join('; ')}` : '',
      p.tasks.length ? `Задачи: ${p.tasks.map((t) => (t.done ? '[сделано] ' : '') + t.text).join('; ')}` : '',
      p.links.length ? `Ссылки: ${p.links.map((l) => LINK_TYPES[l.type].label + ' ' + l.url).join('; ')}` : '',
      p.description ? `Текущее описание: ${p.description}` : '',
    ].filter(Boolean).join('\n');
    const text = await groqChat([{ role: 'system', content: DESC_SYSTEM }, { role: 'user', content: facts }], 800);
    if (!text.trim()) throw new Error('пустой ответ модели');
    p.description = text.trim();
    p.updated = now(); save();
  } catch (err) {
    state.descError = 'Не удалось сгенерировать описание: ' + err.message;
  }
  state.descLoading = false;
  render();
}

async function aiGenerate() {
  const ai = state.ai;
  ai.apiKey = cleanKey(ai.apiKey);
  if (!ai.apiKey) { ai.error = 'Вставьте ключ API Groq в поле справа и нажмите «Сохранить ключ».'; return render(); }
  if (!ai.apiKey.startsWith('gsk_')) {
    ai.error = 'Ключ Groq обычно начинается с gsk_. Скопируйте его заново на console.groq.com/keys и вставьте в поле справа.';
    return render();
  }
  if (ai.text.trim().length < 20) { ai.error = 'Опишите проект хотя бы в паре предложений.'; return render(); }
  ai.loading = true; ai.error = ''; render();
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.apiKey },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.4,
        max_completion_tokens: 2000,
        messages: [
          { role: 'system', content: AI_SYSTEM },
          { role: 'user', content: ai.text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const r = parseJsonLoose(data.choices?.[0]?.message?.content || '');

    let p = state.projects.find((x) => x.id === ai.targetId);
    if (!p) {
      const title = String(r.title || 'Новый проект').trim().slice(0, 120) || 'Новый проект';
      p = newProject();
      p.title = title;
      p.history[0].title = title;
      p.category = AI_CATEGORIES.includes(r.category) ? r.category : 'other';
      state.projects.unshift(p);
      ai.targetId = p.id;
    }
    const goalsAdded = mergeItems(p.goals, cleanList(r.goals), 'goals');
    const tasksAdded = mergeItems(p.tasks, cleanList(r.tasks), 'tasks');
    if (!p.description.trim() && r.employer_text) p.description = String(r.employer_text).trim();
    p.updated = now();
    save();
    ai.result = {
      projectId: p.id,
      projectTitle: p.title,
      employerText: String(r.employer_text || '').trim(),
      goalsAdded,
      tasksAdded,
    };
  } catch (err) {
    ai.error = 'Не удалось сгенерировать: ' + err.message +
      (err instanceof TypeError ? ' (проверьте интернет и ключ API)' : '');
    if (/Groq ответил 401/.test(err.message)) ai.error = 'Groq не принял ключ (ошибка 401). Проверьте, что ключ актуален и вставлен полностью.';
  }
  ai.loading = false;
  render();
}

function applyEmployerText() {
  const r = state.ai.result;
  const p = r && state.projects.find((x) => x.id === r.projectId);
  if (!p || !r.employerText) return;
  p.description = r.employerText;
  p.updated = now();
  save();
  state.activeId = p.id;
  state.tab = 'projects';
  render();
}

function renderAI() {
  const ai = state.ai;
  const r = ai.result;
  const projOpts = [
    `<option value="new" ${ai.targetId === 'new' ? 'selected' : ''}>Новый проект</option>`,
    ...state.projects.map((p) => `<option value="${p.id}" ${p.id === ai.targetId ? 'selected' : ''}>${esc(p.title)}</option>`),
  ].join('');

  $('#main').innerHTML = `
    <div class="ai-page">
      <header class="ai-head">
        <h1>Интеграция ИИ</h1>
        <p class="muted">Опишите проект своими словами. ИИ напишет текст для работодателей и заполнит цели и задачи. Опишите один проект за раз.</p>
      </header>
      <div class="grid2" style="margin-top:0">
        <section class="box">
          <div class="box-head"><h2 class="box-title">О проекте</h2></div>
          <div class="box-body">
            <textarea class="desc ai-input" data-ai="text" rows="10" placeholder="Что за проект, для кого, что сделали, на чём, какой результат. Например: сделала сайт для кофейни на React, заказы через форму и Telegram, за месяц 120 заявок.">${esc(ai.text)}</textarea>
            <div class="ai-controls">
              <label class="field"><span>Куда добавить цели и задачи</span>
                <select class="btn" data-ai="target">${projOpts}</select></label>
              <label class="field"><span>Модель</span>
                <select class="btn" data-ai="model">${GROQ_MODELS.map((m) =>
                  `<option value="${m.id}" ${m.id === ai.model ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
              <button class="btn btn-primary" data-action="aiGenerate" ${ai.loading ? 'disabled' : ''}>${ai.loading ? 'Генерирую…' : 'Сгенерировать'}</button>
            </div>
            ${ai.error ? `<p class="ai-error">${esc(ai.error)}</p>` : ''}
          </div>
        </section>
        <section class="box">
          <div class="box-head"><h2 class="box-title">Ключ API Groq</h2></div>
          <div class="box-body">
            <input class="input" data-ai="key" type="password" autocomplete="off" placeholder="gsk_…" value="${esc(ai.apiKey)}">
            <div class="ai-controls">
              <button class="btn" data-action="saveKey">Сохранить ключ</button>
              <span class="muted small">${ai.apiKey ? 'Ключ сохранён в этом браузере' : 'Ключ не задан'}</span>
            </div>
            <p class="muted small" style="margin:12px 0 0">Ключ хранится только в этом браузере и отправляется напрямую в Groq. Ключ можно создать на console.groq.com/keys.</p>
          </div>
        </section>
      </div>
      ${r ? `<section class="box ai-result" style="margin-top:24px">
        <div class="box-head">
          <h2 class="box-title">Для работодателей · ${esc(r.projectTitle)}</h2>
          <div class="ai-controls">
            <button class="btn btn-small" data-action="aiCopy">Копировать</button>
            <button class="btn btn-small btn-primary" data-action="aiApply">Записать в описание проекта</button>
          </div>
        </div>
        <div class="box-body">
          <p class="employer-text">${esc(r.employerText)}</p>
          <p class="muted small" style="margin:0">Добавлено целей: ${r.goalsAdded}, задач: ${r.tasksAdded}. Они уже в проекте.</p>
        </div>
      </section>` : ''}
    </div>`;
}

load();
restoreUI();
state.ai.apiKey = (function () { try { return cleanKey(localStorage.getItem(GROQ_KEY)); } catch (e) { return ''; } })();
render();
const themeBtn = $('#themeBtn');
if (themeBtn) setThemeButton(themeBtn);
