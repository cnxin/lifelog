const STORAGE_KEY = "lifelog-mobile-demo-v2";

const icons = {
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  map: '<path d="M14.1 5.1a3 3 0 1 1-4.2 4.2 3 3 0 0 1 4.2-4.2Z"/><path d="M12 21s7-5.1 7-12A7 7 0 0 0 5 9c0 6.9 7 12 7 12Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7V21a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H2a2.1 2.1 0 0 1 0-4.2h.2a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 1 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7V2a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 1 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2a2.1 2.1 0 0 1 0 4.2h-.2a1.8 1.8 0 0 0-1.7 1.2Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="3"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'
};

const navItems = [
  { key: "home", label: "首页", icon: "home" },
  { key: "people", label: "人物", icon: "users" },
  { key: "places", label: "地点", icon: "map" },
  { key: "memories", label: "回忆", icon: "heart" },
  { key: "settings", label: "设置", icon: "settings" }
];

const seed = {
  people: [
    {
      id: "p1",
      name: "小明",
      nickname: "明明",
      relationship: "朋友",
      birthday: "1999-04-15",
      favorite: true,
      preferences: ["蓝色", "火锅", "美式咖啡"],
      dislikes: ["花生过敏", "不喜欢香菜"],
      anniversaries: [{ title: "生日", date: "1999-04-15" }],
      notes: "喜欢安静靠窗的位置。"
    },
    {
      id: "p2",
      name: "小红",
      nickname: "",
      relationship: "同事",
      birthday: "2000-09-01",
      favorite: true,
      preferences: ["悬疑电影", "抹茶", "猫"],
      dislikes: ["不吃辣"],
      anniversaries: [{ title: "相识日", date: "2024-09-01" }],
      notes: "适合约电影和咖啡。"
    },
    {
      id: "p3",
      name: "妈妈",
      nickname: "",
      relationship: "家人",
      birthday: "1976-11-18",
      favorite: true,
      preferences: ["暖色围巾", "清淡菜", "散步"],
      dislikes: ["太甜"],
      anniversaries: [{ title: "生日", date: "1976-11-18" }],
      notes: "送礼优先考虑实用。"
    }
  ],
  places: [
    {
      id: "l1",
      name: "海底捞万达店",
      category: "餐厅",
      emoji: "🍲",
      rating: 4.8,
      cost: 120,
      desc: "服务稳定，适合多人聚餐。",
      tags: ["火锅", "聚餐"],
      favorite: true
    },
    {
      id: "l2",
      name: "Blue Bottle 咖啡",
      category: "咖啡厅",
      emoji: "☕",
      rating: 4.6,
      cost: 42,
      desc: "环境安静，适合聊天。",
      tags: ["咖啡", "安静"],
      favorite: false
    },
    {
      id: "l3",
      name: "万达影城 IMAX",
      category: "电影院",
      emoji: "🎬",
      rating: 4.3,
      cost: 58,
      desc: "音效不错，周末排队久。",
      tags: ["电影", "商场"],
      favorite: false
    }
  ],
  memories: [
    {
      id: "m1",
      title: "和小明吃火锅",
      date: "2026-04-24",
      personIds: ["p1"],
      placeId: "l1",
      mood: "轻松",
      content: "小明很喜欢番茄锅和虾滑，下次可以提前排号。",
      tags: ["聚餐", "火锅"]
    },
    {
      id: "m2",
      title: "周末看电影",
      date: "2026-04-26",
      personIds: ["p2"],
      placeId: "l3",
      mood: "愉快",
      content: "看完电影后聊了很久，附近咖啡店可以作为下次备选。",
      tags: ["电影"]
    }
  ]
};

let state = load();
let view = "home";
let placeFilter = "全部";
let query = "";

const main = document.querySelector("#mainContent");
const pageTitle = document.querySelector("#pageTitle");
const pageSubtitle = document.querySelector("#pageSubtitle");
const bottomNav = document.querySelector("#bottomNav");
const sheet = document.querySelector("#sheet");
const entryForm = document.querySelector("#entryForm");
const sheetTitle = document.querySelector("#sheetTitle");
const sheetKicker = document.querySelector("#sheetKicker");

function svg(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(seed);
  } catch {
    return structuredClone(seed);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(value = "") {
  return String(value).split(/[，,]/).map((item) => item.trim()).filter(Boolean);
}

function personName(id) {
  return state.people.find((person) => person.id === id)?.name || "未关联人物";
}

function placeName(id) {
  return state.places.find((place) => place.id === id)?.name || "未关联地点";
}

function initials(name) {
  return (name || "?").slice(0, 2);
}

function formatDate(date) {
  if (!date) return "未设置";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric"
  });
}

function fullDate(date) {
  if (!date) return "未设置";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const source = new Date(`${date}T00:00:00`);
  let next = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  return Math.round((next - today) / 86400000);
}

function getUpcoming() {
  return state.people
    .flatMap((person) => person.anniversaries.map((item) => ({
      ...item,
      person: person.name,
      days: daysUntil(item.date)
    })))
    .sort((a, b) => a.days - b.days);
}

function setHeader(title, subtitle) {
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;
}

function renderNav() {
  bottomNav.innerHTML = navItems.map((item) => `
    <button class="nav-item ${view === item.key ? "active" : ""}" data-view="${item.key}">
      ${svg(item.icon)}
      <span>${item.label}</span>
    </button>
  `).join("");

  bottomNav.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      query = "";
      render();
    });
  });
}

function render() {
  renderNav();
  const screens = {
    home: renderHome,
    people: renderPeople,
    places: renderPlaces,
    memories: renderMemories,
    settings: renderSettings
  };
  screens[view]();
}

function renderHome() {
  setHeader("下午好", "今天有新的回忆值得记录");
  const upcoming = getUpcoming().slice(0, 4);
  const recent = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);

  main.innerHTML = `
    <section class="section">
      <div class="section-header">
        <h2>${svg("calendar")}纪念日</h2>
        <button class="see-all" data-view-link="people">查看</button>
      </div>
      <div class="anniversary-scroll">
        ${upcoming.map((item, index) => `
          <article class="glass-card anniversary-card ${index % 2 ? "secondary" : ""}">
            <div class="a-title">${esc(item.person)} · ${esc(item.title)}</div>
            <div class="a-days">${item.days}<span>天</span></div>
            <div class="a-date">${formatDate(item.date)}</div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section">
      <div class="glass-card insight-card">
        <div class="metric"><strong>${state.people.length}</strong><span>人物</span></div>
        <div class="metric"><strong>${state.places.length}</strong><span>地点</span></div>
        <div class="metric"><strong>${state.memories.length}</strong><span>回忆</span></div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2>${svg("users")}收藏的人</h2>
        <button class="see-all" data-view-link="people">全部</button>
      </div>
      <div class="favorites-grid">
        ${favorites.map((person) => `
          <div class="favorite-item">
            <div class="fav-avatar">${esc(initials(person.name))}</div>
            <div class="fav-name">${esc(person.name)}</div>
          </div>
        `).join("")}
        <button class="favorite-item add-btn" data-open="person" aria-label="添加人物">${svg("plus")}</button>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2>${svg("clock")}最近回忆</h2>
        <button class="see-all" data-view-link="memories">全部</button>
      </div>
      <div class="list">
        ${recent.map(memoryCard).join("")}
      </div>
    </section>
  `;
  bindCommon();
}

function renderPeople() {
  setHeader("人物", "记录喜好、禁忌和纪念日");
  const people = state.people.filter((person) => {
    const text = [person.name, person.nickname, person.relationship, person.preferences.join(","), person.notes].join(" ");
    return text.toLowerCase().includes(query.toLowerCase());
  });

  main.innerHTML = `
    ${searchBar("搜索姓名、喜好、关系")}
    <section class="section">
      <div class="list">
        ${people.length ? people.map(personCard).join("") : empty("没有找到人物")}
      </div>
    </section>
  `;
  bindSearch();
}

function personCard(person) {
  const anniversary = person.anniversaries[0];
  return `
    <article class="glass-card person-card">
      <div class="person-photo">${esc(initials(person.name))}</div>
      <div class="person-info">
        <div class="person-name">
          <span>${esc(person.name)}${person.nickname ? ` · ${esc(person.nickname)}` : ""}</span>
          ${person.favorite ? svg("star") : ""}
        </div>
        <p class="person-desc">${esc(person.relationship)} · ${anniversary ? `${esc(anniversary.title)}还有 ${daysUntil(anniversary.date)} 天` : "暂无纪念日"}</p>
        <div class="tags">
          ${person.preferences.slice(0, 3).map((item) => `<span class="tag">${esc(item)}</span>`).join("")}
          ${person.dislikes[0] ? `<span class="tag orange">${esc(person.dislikes[0])}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderPlaces() {
  setHeader("地点", "餐厅、酒店、景点和电影院");
  const categories = ["全部", ...new Set(state.places.map((place) => place.category))];
  const places = state.places.filter((place) => {
    const inCategory = placeFilter === "全部" || place.category === placeFilter;
    const inSearch = [place.name, place.category, place.desc, place.tags.join(",")].join(" ").toLowerCase().includes(query.toLowerCase());
    return inCategory && inSearch;
  });

  main.innerHTML = `
    ${searchBar("搜索地点、分类、标签")}
    <div class="category-row">
      ${categories.map((category) => `
        <button class="category-pill ${category === placeFilter ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>
      `).join("")}
    </div>
    <section class="section">
      <div class="list">
        ${places.length ? places.map(placeCard).join("") : empty("没有找到地点")}
      </div>
    </section>
  `;
  bindSearch();
  main.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      placeFilter = button.dataset.category;
      render();
    });
  });
}

function placeCard(place) {
  return `
    <article class="glass-card place-card">
      <div class="place-img">${esc(place.emoji)}</div>
      <div class="place-info">
        <div class="place-name">
          <span>${esc(place.name)}</span>
          <span class="place-rating">${svg("star")} ${place.rating}</span>
        </div>
        <p class="place-desc">${esc(place.category)} · 人均 ¥${place.cost} · ${esc(place.desc)}</p>
        <div class="tags">
          ${place.tags.map((tag, index) => `<span class="tag ${index % 2 ? "orange" : ""}">${esc(tag)}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderMemories() {
  setHeader("回忆", "把人物和地点串起来");
  const memories = [...state.memories]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((memory) => {
      const text = [
        memory.title,
        memory.content,
        memory.mood,
        memory.personIds.map(personName).join(","),
        placeName(memory.placeId),
        memory.tags.join(",")
      ].join(" ");
      return text.toLowerCase().includes(query.toLowerCase());
    });

  main.innerHTML = `
    ${searchBar("搜索回忆、人物、地点")}
    <section class="section">
      <div class="list">
        ${memories.length ? memories.map(memoryCard).join("") : empty("没有找到回忆")}
      </div>
    </section>
  `;
  bindSearch();
}

function memoryCard(memory) {
  return `
    <article class="glass-card memory-card">
      <div class="memory-badge">${svg("heart")}</div>
      <div class="memory-info">
        <div class="memory-title">
          <span>${esc(memory.title)}</span>
          <span class="place-rating">${formatDate(memory.date)}</span>
        </div>
        <p class="memory-desc">${esc(memory.personIds.map(personName).join("、"))} · ${esc(placeName(memory.placeId))}</p>
        <p class="memory-desc">${esc(memory.content)}</p>
        <div class="tags">
          <span class="tag orange">${esc(memory.mood)}</span>
          ${memory.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderSettings() {
  setHeader("设置", "本地数据和后续能力");
  main.innerHTML = `
    <section class="section">
      <div class="glass-card memory-card">
        <div class="memory-badge">${svg("export")}</div>
        <div class="memory-info">
          <div class="memory-title">数据导出</div>
          <p class="memory-desc">导出当前 localStorage 演示数据。正式版会替换为 IndexedDB/Dexie。</p>
          <div class="tags">
            <button class="category-pill active" id="exportBtn">导出 JSON</button>
            <button class="category-pill" id="resetBtn">重置 Demo</button>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>${svg("star")}后续路线</h2></div>
      <div class="tags">
        <span class="tag">React 组件化</span>
        <span class="tag">Dexie IndexedDB</span>
        <span class="tag">PWA</span>
        <span class="tag orange">Capacitor Android</span>
        <span class="tag orange">本地通知</span>
      </div>
    </section>
  `;
  document.querySelector("#exportBtn").addEventListener("click", exportData);
  document.querySelector("#resetBtn").addEventListener("click", () => {
    if (!confirm("确认重置演示数据？")) return;
    state = structuredClone(seed);
    persist();
    render();
  });
}

function searchBar(placeholder) {
  return `
    <div class="search-bar">
      ${svg("search")}
      <input id="searchInput" value="${esc(query)}" placeholder="${placeholder}" />
    </div>
  `;
}

function bindSearch() {
  const input = document.querySelector("#searchInput");
  if (!input) return;
  input.addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });
}

function bindCommon() {
  main.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.viewLink;
      query = "";
      render();
    });
  });
  main.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openSheet(button.dataset.open));
  });
}

function openSheet(type = "memory") {
  const labels = {
    person: ["新增人物", "记录一个重要的人"],
    place: ["新增地点", "保存一个值得记住的地点"],
    memory: ["新增回忆", "把人物和地点连接起来"]
  };
  const [title, subtitle] = labels[type] || labels.memory;
  sheetTitle.textContent = title;
  sheetKicker.textContent = subtitle;
  entryForm.innerHTML = formHtml(type);
  entryForm.onsubmit = (event) => {
    event.preventDefault();
    saveEntry(type, new FormData(entryForm));
  };
  sheet.classList.remove("hidden");
}

function formHtml(type) {
  if (type === "person") {
    return `
      <div class="form-row">
        ${field("姓名", "name", "text", "小蓝")}
        ${field("关系", "relationship", "text", "朋友")}
      </div>
      ${field("生日", "birthday", "date")}
      ${field("喜好，逗号分隔", "preferences", "text", "咖啡，蓝色，电影")}
      ${field("禁忌，逗号分隔", "dislikes", "text", "不吃辣")}
      ${field("备注", "notes", "textarea", "这里记录一些重要细节。")}
      ${submitButtons()}
    `;
  }

  if (type === "place") {
    return `
      <div class="form-row">
        ${field("地点名称", "name", "text", "新餐厅")}
        ${field("分类", "category", "text", "餐厅")}
      </div>
      <div class="form-row">
        ${field("评分", "rating", "number", "4.5")}
        ${field("人均", "cost", "number", "80")}
      </div>
      ${field("描述", "desc", "textarea", "适合约会或聚餐。")}
      ${field("标签，逗号分隔", "tags", "text", "安静，推荐")}
      ${submitButtons()}
    `;
  }

  return `
    ${field("标题", "title", "text", "新的回忆")}
    <div class="form-row">
      ${field("日期", "date", "date", new Date().toISOString().slice(0, 10))}
      ${field("心情", "mood", "text", "开心")}
    </div>
    ${selectField("关联人物", "personId", state.people)}
    ${selectField("关联地点", "placeId", state.places)}
    ${field("内容", "content", "textarea", "记录今天发生的事，以及下次要注意什么。")}
    ${field("标签，逗号分隔", "tags", "text", "日常，值得记住")}
    ${submitButtons()}
  `;
}

function field(label, name, type = "text", value = "") {
  if (type === "textarea") {
    return `<label>${label}<textarea name="${name}">${esc(value)}</textarea></label>`;
  }
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" /></label>`;
}

function selectField(label, name, options) {
  return `
    <label>${label}
      <select name="${name}">
        ${options.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}
      </select>
    </label>
  `;
}

function submitButtons() {
  return `
    <div class="submit-row">
      <button type="button" class="ghost-btn" id="cancelBtn">取消</button>
      <button type="submit" class="primary-btn">保存</button>
    </div>
  `;
}

function saveEntry(type, form) {
  if (type === "person") {
    state.people.push({
      id: uid("p"),
      name: form.get("name") || "未命名",
      nickname: "",
      relationship: form.get("relationship") || "朋友",
      birthday: form.get("birthday") || "",
      favorite: false,
      preferences: list(form.get("preferences")),
      dislikes: list(form.get("dislikes")),
      anniversaries: form.get("birthday") ? [{ title: "生日", date: form.get("birthday") }] : [],
      notes: form.get("notes") || ""
    });
    view = "people";
  }

  if (type === "place") {
    state.places.push({
      id: uid("l"),
      name: form.get("name") || "未命名地点",
      category: form.get("category") || "其他",
      emoji: "📍",
      rating: Number(form.get("rating")) || 4,
      cost: Number(form.get("cost")) || 0,
      desc: form.get("desc") || "",
      tags: list(form.get("tags")),
      favorite: false
    });
    view = "places";
  }

  if (type === "memory") {
    state.memories.push({
      id: uid("m"),
      title: form.get("title") || "新的回忆",
      date: form.get("date") || new Date().toISOString().slice(0, 10),
      personIds: [form.get("personId")].filter(Boolean),
      placeId: form.get("placeId") || "",
      mood: form.get("mood") || "平静",
      content: form.get("content") || "",
      tags: list(form.get("tags"))
    });
    view = "memories";
  }

  persist();
  closeSheet();
  render();
}

function closeSheet() {
  sheet.classList.add("hidden");
  entryForm.innerHTML = "";
}

function empty(text) {
  return `<div class="glass-card empty">${esc(text)}</div>`;
}

function exportData() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifelog-demo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector("#todayLabel").textContent = new Date().toLocaleDateString("zh-CN", {
  weekday: "long",
  month: "long",
  day: "numeric"
});

document.querySelector("#fabBtn").addEventListener("click", () => {
  const typeByView = { people: "person", places: "place", memories: "memory" };
  openSheet(typeByView[view] || "memory");
});

document.querySelector("#sheetClose").addEventListener("click", closeSheet);
document.querySelector("#sheetBackdrop").addEventListener("click", closeSheet);
entryForm.addEventListener("click", (event) => {
  if (event.target.id === "cancelBtn") closeSheet();
});

persist();
render();
