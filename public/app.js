/* Портфолио: проекты, версии названия, цели/задачи, ссылки, фото, предпросмотр, тема */
const STORE_KEY = 'portfolio-projects-v1';
const THEME_KEY = 'portfolio-theme';
const CATEGORIES = { all: 'Все', site: 'Сайт', game: 'Игра', education: 'Обучение', other: 'Другое' };
const LINK_TYPES = {
  github: { label: 'GitHub', icon: '🐙' },
  site: { label: 'Сайт', icon: '🌐' },
  project: { label: 'Проект', icon: '🔗' },
};
const ICONS = ['📁', '🚀', '🎮', '📚', '🎨', '💡', '🧩', '🛒', '📱', '🌿', '🧠', '🎵', '🤖', '📷'];

const state = {
  projects: [],
  activeId: null,
  filter: 'all',
  showHistory: false,
  showIcon: false,
  showLinkForm: false,
  previewId: null,
  draft: { goal: '', task: '', linkUrl: '', linkLabel: '', linkType: 'site' },
};

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const bump = (v) => { const [a, b] = v.split('.').map(Number); return `${a}.${b + 1}`; };
const active = () => state.projects.find((p) => p.id === state.activeId) || null;
const isImg = (s) => typeof s === 'string' && s.startsWith('data:');
const iconHtml = (icon, cls) => isImg(icon)
  ? `<img class="${cls}" src="${icon}" alt="">`
  : `<span class="${cls}">${esc(icon || '📁')}</span>`;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

/* ---------- данные ---------- */
function seed() {
  const t = now();
  return {
    id: uid(), title: 'Мой первый проект', version: '1.1', category: 'site', icon: '🚀',
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
    id: uid(), title: 'Новый проект', version: '1.0', category: 'other', icon: '📁',
    description: '', goals: [], tasks: [], links: [], images: [],
    history: [{ version: '1.0', title: 'Новый проект', date: t }], created: t, updated: t,
  };
}
// Старые проекты с одним изображением переводим в список фото
function migrate(p) {
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
function render(focusSel) {
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
        <button class="check" data-action="toggleTask" data-id="${t.id}" aria-label="Отметить">${t.done ? '✓' : ''}</button>
        <span class="row-text">${esc(t.text)}</span>
        <button class="x" data-action="delItem" data-kind="tasks" data-id="${t.id}" title="Удалить">×</button></li>`).join('')}</ul>
    <div class="add-row">
      <input data-draft="task" value="${esc(d.task)}" placeholder="Новая задача">
      <button class="btn btn-small" data-action="addItem" data-kind="tasks">Добавить</button>
    </div>`);

  const linksBody = `
    ${state.showLinkForm ? `<div class="linkform">
        <div class="chips">${Object.entries(LINK_TYPES).map(([k, v]) =>
          `<button class="chip ${d.linkType === k ? 'on' : ''}" data-action="setLinkType" data-type="${k}">${v.icon} ${v.label}</button>`).join('')}</div>
        <input data-draft="linkUrl" value="${esc(d.linkUrl)}" placeholder="Ссылка, например https://github.com/...">
        <div class="line">
          <input data-draft="linkLabel" value="${esc(d.linkLabel)}" placeholder="Подпись (необязательно)">
          <button class="btn btn-primary" data-action="addLink">Добавить</button>
        </div>
      </div>` : ''}
    <div class="links">${p.links.length ? p.links.map((l) => `
      <div class="link-row">
        <span class="li-icon">${LINK_TYPES[l.type].icon}</span>
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
        <div class="emoji-grid">${ICONS.map((e) => `<button data-action="setIcon" data-emoji="${e}">${e}</button>`).join('')}</div>
        <button class="btn btn-small" data-action="uploadIcon">Загрузить свою картинку</button>
      </div>` : ''}
    ${state.showHistory ? historyHtml(p) : ''}
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
    case 'toggleTheme': {
      const dark = !isDark();
      if (dark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (err) {}
      el.textContent = dark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
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
    case 'setIcon': p.icon = el.dataset.emoji; state.showIcon = false; p.updated = now(); save(); render(); break;
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

load();
render();
const themeBtn = $('#themeBtn');
if (themeBtn) themeBtn.textContent = isDark() ? '☀️ Светлая тема' : '🌙 Тёмная тема';
