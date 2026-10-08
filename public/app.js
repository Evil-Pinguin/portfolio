/* Портфолио: проекты, версии названия, цели/задачи, ссылки, изображение, предпросмотр */
const STORE_KEY = 'portfolio-projects-v1';
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

function seed() {
  const t = now();
  return {
    id: uid(), title: 'Мой первый проект', version: '1.1', category: 'site', icon: '🚀', image: null,
    description: 'Здесь коротко описываю, что это за проект и зачем он нужен.',
    goals: [{ id: uid(), text: 'Собрать все проекты в одном месте' }],
    tasks: [{ id: uid(), text: 'Добавить ссылку на GitHub', done: true }, { id: uid(), text: 'Добавить сайт', done: false }],
    links: [{ id: uid(), type: 'github', label: 'GitHub', url: 'https://github.com/Evil-Pinguin/portfolio' }],
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
    id: uid(), title: 'Новый проект', version: '1.0', category: 'other', icon: '📁', image: null,
    description: '', goals: [], tasks: [], links: [],
    history: [{ version: '1.0', title: 'Новый проект', date: t }], created: t, updated: t,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state.projects = raw ? JSON.parse(raw) : [seed()];
  } catch { state.projects = [seed()]; }
  state.activeId = state.projects[0]?.id ?? null;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.projects)); }
  catch { alert('Не хватает места в хранилище браузера. Попробуйте изображение меньшего размера.'); }
}

/* ---------- render ---------- */
function render(focusSel) {
  renderSidebar();
  renderMain();
  document.querySelectorAll('textarea').forEach(autosize);
  if (focusSel) { const el = document.querySelector(focusSel); if (el) el.focus(); }
}

function renderSidebar() {
  const list = state.projects.filter((p) => state.filter === 'all' || p.category === state.filter);
  $('#sidebar').innerHTML = `
    <div class="brand">Портфолио</div>
    <button class="btn-new" data-action="new">+ Новый проект</button>
    <div class="chips">${Object.entries(CATEGORIES).map(([k, v]) =>
      `<button class="chip ${state.filter === k ? 'on' : ''}" data-action="filter" data-cat="${k}">${v}</button>`).join('')}</div>
    <nav class="plist">${list.length ? list.map((p) => `
      <button class="pitem ${p.id === state.activeId ? 'on' : ''}" data-action="select" data-id="${p.id}">
        ${iconHtml(p.icon, 'pi-icon')}
        <span class="pi-text">
          <span class="pi-title">${esc(p.title)}</span>
          <span class="pi-meta">${CATEGORIES[p.category]} · v${p.version}</span>
        </span>
      </button>`).join('') : '<p class="muted small">Проектов пока нет</p>'}
    </nav>`;
}

function historyHtml(p) {
  return `<div class="history" id="historyBox">${p.history.map((h, i) => `
    <div class="hrow">
      <span class="ver-tag">v${h.version}</span>
      <span class="hr-title">${esc(h.title)}</span>
      <span class="muted small">${fmtDate(h.date)}</span>
      ${i === 0 ? '<span class="muted small">текущая</span>'
        : `<button class="ghost" data-action="restore" data-idx="${i}">Вернуть</button>`}
    </div>`).join('')}</div>`;
}

function renderMain() {
  const main = $('#main');
  const p = active();
  if (!p) {
    main.innerHTML = `<div class="empty">
      <h1>Все ваши проекты — в одном месте</h1>
      <p class="muted">Создайте проект: название с историей версий, описание, цели и задачи, ссылки на GitHub и сайт, изображение и предпросмотр.</p>
      <button class="btn-new" data-action="new">+ Новый проект</button></div>`;
    return;
  }
  const d = state.draft;
  const doneCount = p.tasks.filter((t) => t.done).length;
  const siteLinks = p.links.filter((l) => l.type === 'site');
  const preview = siteLinks.find((l) => l.id === state.previewId) || siteLinks[0];

  main.innerHTML = `
    <div class="topbar">
      <div class="chips">${Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([k, v]) =>
        `<button class="chip ${p.category === k ? 'on' : ''}" data-action="setCat" data-cat="${k}">${v}</button>`).join('')}</div>
      <button class="ghost danger" data-action="delete">Удалить проект</button>
    </div>

    <section>
      <button class="icon-btn" data-action="toggleIcon" title="Сменить иконку">${iconHtml(p.icon, 'big-icon')}</button>
      ${state.showIcon ? `<div class="popover">
          <div class="emoji-grid">${ICONS.map((e) => `<button data-action="setIcon" data-emoji="${e}">${e}</button>`).join('')}</div>
          <button class="ghost" data-action="uploadIcon">Загрузить свою картинку</button>
        </div>` : ''}
      <input class="title" data-field="title" value="${esc(p.title)}" maxlength="120" aria-label="Название проекта">
      <div class="verrow">
        <button class="ver" data-action="toggleHistory" title="История версий">v${p.version}</button>
        <span class="muted small">История названия · обновлено ${fmtDate(p.updated)}</span>
      </div>
      ${state.showHistory ? historyHtml(p) : ''}
      <textarea class="desc" data-field="description" rows="2" placeholder="Коротко о проекте: что это и зачем">${esc(p.description)}</textarea>
    </section>

    <section class="goals-tasks">
      <div class="frame">
        <h3>Цели <span class="count">${p.goals.length}</span></h3>
        <ul class="list">${p.goals.map((g) => `
          <li class="row"><span class="dot"></span><span class="row-text">${esc(g.text)}</span>
            <button class="x" data-action="delItem" data-kind="goals" data-id="${g.id}" title="Удалить">×</button></li>`).join('')}</ul>
        <div class="add">
          <input data-draft="goal" value="${esc(d.goal)}" placeholder="Новая цель">
          <button class="plus" data-action="addItem" data-kind="goals" title="Добавить">+</button>
        </div>
      </div>
      <div class="frame">
        <h3>Задачи <span class="count">${doneCount}/${p.tasks.length}</span></h3>
        <ul class="list">${p.tasks.map((t) => `
          <li class="row ${t.done ? 'done' : ''}">
            <button class="check" data-action="toggleTask" data-id="${t.id}" aria-label="Отметить">${t.done ? '✓' : ''}</button>
            <span class="row-text">${esc(t.text)}</span>
            <button class="x" data-action="delItem" data-kind="tasks" data-id="${t.id}" title="Удалить">×</button></li>`).join('')}</ul>
        <div class="add">
          <input data-draft="task" value="${esc(d.task)}" placeholder="Новая задача">
          <button class="plus" data-action="addItem" data-kind="tasks" title="Добавить">+</button>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block-head">
        <h3>Ссылки</h3>
        <button class="plus ${state.showLinkForm ? 'on' : ''}" data-action="toggleLinkForm" title="Добавить ссылку">${state.showLinkForm ? '×' : '+'}</button>
      </div>
      ${state.showLinkForm ? `<div class="linkform">
          <div class="chips">${Object.entries(LINK_TYPES).map(([k, v]) =>
            `<button class="chip ${d.linkType === k ? 'on' : ''}" data-action="setLinkType" data-type="${k}">${v.icon} ${v.label}</button>`).join('')}</div>
          <input data-draft="linkUrl" value="${esc(d.linkUrl)}" placeholder="Ссылка, например https://github.com/...">
          <div class="line">
            <input data-draft="linkLabel" value="${esc(d.linkLabel)}" placeholder="Подпись (необязательно)">
            <button class="btn-new" data-action="addLink">Добавить</button>
          </div>
        </div>` : ''}
      <ul class="links">${p.links.length ? p.links.map((l) => `
        <li class="link-row">
          <span class="li-icon">${LINK_TYPES[l.type].icon}</span>
          <div class="li-text">
            <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>
            <span class="muted small">${LINK_TYPES[l.type].label} · ${esc(l.url)}</span>
          </div>
          <button class="x" data-action="delLink" data-id="${l.id}" title="Удалить">×</button>
        </li>`).join('') : '<li class="muted small">Ссылок пока нет — нажмите +</li>'}</ul>
    </section>

    <section class="block">
      <div class="block-head"><h3>Изображение</h3></div>
      ${p.image ? `<div class="pinned">
          <img src="${p.image}" alt="">
          <div class="btns">
            <button class="ghost" data-action="uploadImage">Заменить</button>
            <button class="ghost danger" data-action="removeImage">Открепить</button>
          </div></div>`
        : `<button class="drop" data-action="uploadImage">📌 Закрепить изображение</button>`}
    </section>

    <section class="block">
      <div class="block-head">
        <h3>Предпросмотр сайта</h3>
        ${siteLinks.length > 1 ? `<select id="previewSelect" class="ghost">${siteLinks.map((l) =>
          `<option value="${l.id}" ${l.id === preview.id ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>` : ''}
      </div>
      ${preview ? `<div class="preview-wrap"><iframe class="preview-frame" src="${esc(preview.url)}" title="Предпросмотр"></iframe></div>
          <p class="muted small preview-note">Если сайт не открывается здесь, <a href="${esc(preview.url)}" target="_blank" rel="noopener">откройте его в новой вкладке</a>.</p>`
        : '<p class="muted">Добавьте ссылку типа «Сайт» — и здесь появится предпросмотр.</p>'}
    </section>`;
}

function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

/* ---------- actions ---------- */
function commitTitle(p, raw, force = false) {
  const t = raw.trim().slice(0, 120);
  if (!t) { renderMain(); return; }
  if (t === p.title && !force) return;
  p.title = t;
  p.version = bump(p.version);
  p.history.unshift({ version: p.version, title: t, date: now() });
  p.updated = now();
  save();
  // Точечное обновление, чтобы не потерять фокус и клики
  const item = document.querySelector(`.pitem[data-id="${p.id}"]`);
  if (item) {
    item.querySelector('.pi-title').textContent = p.title;
    item.querySelector('.pi-meta').textContent = `${CATEGORIES[p.category]} · v${p.version}`;
  }
  const ver = document.querySelector('.ver');
  if (ver) ver.textContent = 'v' + p.version;
  const input = document.querySelector('[data-field="title"]');
  if (input && input.value !== p.title) input.value = p.title;
  const box = document.getElementById('historyBox');
  if (box) box.outerHTML = historyHtml(p);
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
      resolve(c.toDataURL('image/webp', 0.9));
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const p = active();
  const a = el.dataset.action;
  switch (a) {
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
    case 'restore': commitTitle(p, p.history[+el.dataset.idx].title, true); break;
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
    case 'removeImage': p.image = null; p.updated = now(); save(); render(); break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.draft) { state.draft[t.dataset.draft] = t.value; return; }
  if (t.dataset.field === 'description') {
    const p = active(); if (!p) return;
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

// Название сохраняется (и получает новую версию), когда поле теряет фокус
document.addEventListener('focusout', (e) => {
  if (e.target.dataset.field === 'title') {
    const p = active(); if (p) commitTitle(p, e.target.value);
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  const p = active();
  if (t.id === 'iconFile' && t.files[0] && p) {
    p.icon = await resizeImage(t.files[0], 256);
    state.showIcon = false; p.updated = now(); save(); render();
  } else if (t.id === 'imageFile' && t.files[0] && p) {
    try {
      p.image = await resizeImage(t.files[0], 1400);
      p.updated = now(); save(); render();
    } catch { alert('Не удалось открыть изображение'); }
  } else if (t.id === 'previewSelect') {
    state.previewId = t.value; renderMain();
  }
  t.value = '';
});

load();
render();
