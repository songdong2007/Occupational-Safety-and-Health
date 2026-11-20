"use strict";

const icons = {
  shield: '<path d="M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  inspect: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6m-6 5h6"/>',
  track: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 12 2 2 4-4m2 4h2"/>',
  report: '<path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6m-6 4h6"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  building: '<path d="M3 21h18M5 21V9h5v12m0 0V3h8v18m-5-14h2m-2 4h2m-2 4h2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  alert: '<path d="M12 3 2 20h20L12 3Zm0 7v4m0 3v.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const pages = [
  ["overview", "工地總覽", "home"], ["map", "工區圖", "map"],
  ["inspection", "巡檢通報", "inspect"], ["tracking", "改善追蹤", "track"],
  ["reports", "報表匯出", "report"],
];
const constructionZone = { id:"contract-2", name:"二標工區" };
const worksiteCenter = [23.12456, 120.25115];
const statusNames = { open:"待處理", progress:"改善中", review:"待複查", closed:"已結案", late:"逾期" };
const workStatus = { scheduled:"未開始", progress:"施工中", closed:"已完成" };
const workCategories = [
  "整地工程", "道路工程", "排水工程", "灌溉排水工程", "交通工程", "結構工程", "大地工程",
  "污水管線工程", "自來水工程", "景觀工程", "照明及號誌工程", "纜線管道工程", "標誌標線工程",
];
const inspectionTopics = [
  "墜落與開口防護", "開挖與擋土支撐", "施工架與工作平台", "吊掛與起重作業",
  "施工機具與車輛動線", "施工區圍設與交通維持", "臨時用電與感電防護", "物體飛落與材料堆置",
  "個人防護具", "局限空間作業", "動火作業與防火", "粉塵、噪音及化學品暴露", "高氣溫作業", "其他職安衛事項",
];
const hazardTips = {
  "排水開挖":"確認開挖區圍設、出入口及人員與機具動線。",
  "交維設施":"確認導引標誌、警示設施及人車分隔。",
  "路面鋪設":"確認車輛倒車引導、施工區隔離及高溫材料作業動線。",
  "高處作業":"確認工作面、通道及墜落防護。",
  "吊掛作業":"確認吊掛作業管制區、指揮與通訊方式。",
  "臨時用電":"確認電源、配線與設備過路保護。",
};
const main = document.querySelector("main");
const dialog = document.querySelector("#record");
const dialogContent = document.querySelector("#record-content");
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => (
  { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]
));
const el = escapeHTML;
const dateKey = (date = new Date()) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0"),
].join("-");
const today = dateKey();
function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
function issueStatus(record) {
  return record.status !== "closed" && record.due < today ? "late" : record.status;
}
const sampleRecordIds = new Set(["巡-0001", "巡-0002", "巡-0003"]);
const sampleWorkIds = new Set(["W01", "W02", "W03"]);
function initialData() {
  return {
    work: [
      { id:"W01", title:"排水開挖", zone:constructionZone.id, location:"K0+230 · DR-07", owner:"土木班", date:today, status:"progress" },
      { id:"W02", title:"交維設施", zone:constructionZone.id, location:"K0+670 · TC-02", owner:"交維班", date:today, status:"progress" },
      { id:"W03", title:"路面鋪設", zone:constructionZone.id, location:"K1+120", owner:"鋪面班", date:today, status:"scheduled" },
    ],
    records:[],
    nextId:4,
    draft:null,
    legacyDraftCleared:true,
  };
}
let db;
let data;
let currentPage;
let trackingFilter = "all";
let reportType = "inspection";
const weekStartOffset = (new Date().getDay() + 6) % 7;
let reportFrom = offsetDate(-weekStartOffset);
let reportTo = offsetDate(6 - weekStartOffset);
let inspectionView = null;
let activeInspectionMap = null;
let inspectionMapLibrary;
let toastTimer;
let savingForm = false;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("worksite-safety-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function save(next) {
  const expected = data ? (data.revision ?? 0) : null;
  const updated = { ...next, revision:(expected ?? 0) + 1 };
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("workspace", "readwrite");
    const store = transaction.objectStore("workspace");
    const read = store.get("data");
    let conflict = false;
    read.onsuccess = () => {
      const actual = read.result ? (read.result.revision ?? 0) : null;
      if (actual === expected) {
        store.put(updated, "data");
      } else {
        conflict = true;
        transaction.abort();
      }
    };
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(conflict
      ? new Error("其他分頁已更新紀錄，請備份目前輸入後重新載入。")
      : transaction.error);
  });
  data = updated;
}
function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ""; }, 4600);
}
async function commitForm(form, action) {
  if (savingForm) return;
  savingForm = true;
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    notify(error.message || "儲存失敗，請保留輸入後重試。");
  } finally {
    savingForm = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}
function imageList(files) {
  if (files.length > 5) throw new Error("每次最多上傳 5 張照片。");
  const date = dateKey();
  return Promise.all([...files].map(async (file) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      throw new Error("請選擇 JPG、PNG、WebP 或 GIF 照片。");
    }
    if (file.size > 8 * 1024 * 1024) throw new Error("每張照片須小於或等於 8 MB。");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name:file.name, url:reader.result, date });
      reader.onerror = () => reject(new Error("照片讀取失敗。"));
      reader.readAsDataURL(file);
    });
  }));
}
function photos(items) {
  if (!items.length) return '<p class="field-note">尚無照片</p>';
  return `<div class="photos">${items.map((item, i) => `
    <a href="${el(item.url)}" download="${el(item.name)}" aria-label="下載照片 ${i + 1}"><img src="${el(item.url)}" alt="${el(item.name || `照片 ${i + 1}`)}"></a>`).join("")}</div>`;
}
function panel(title, content, action = "", symbol = "") {
  return `<section class="panel"><div class="section-head"><h2>${symbol ? icon(symbol) : ""}${title}</h2>${action}</div>${content}</section>`;
}
function heading(title, description, action = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function table(columns, rows, empty = "目前沒有符合條件的紀錄。") {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th scope="col">${column}</th>`).join("")}</tr></thead>
    <tbody>${rows.length ? rows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty" colspan="${columns.length}">${empty}</td></tr>`}</tbody></table></div>`;
}
const badge = (key, label = statusNames[key]) => `<span class="badge ${key}">${label}</span>`;
const btnLink = (route, text, symbol = "", primary = false) =>
  `<a class="btn${primary ? " primary" : ""}" href="#${route}">${symbol ? icon(symbol) : ""}${text}</a>`;
const recordButton = (record) => `<button type="button" class="link" data-record="${el(record.id)}">${el(record.title)}</button>`;
const workToday = () => data.work.filter((entry) => entry.date === today);
const recentRecords = () => [...data.records].reverse().sort((a, b) => b.date.localeCompare(a.date));
const openRecords = () => data.records.filter((record) => record.status !== "closed");

function overview() {
  const work = workToday();
  const late = openRecords().filter((record) => issueStatus(record) === "late");
  const stats = [
    ["今日施工", work.length, "查看工區與施工位置", "map", "building", ""],
    ["待改善／複查", openRecords().length, "查看未結案事項", "tracking/open", "inspect", "amber"],
    ["逾期事項", late.length, "查看逾期改善", "tracking/late", "clock", "red"],
    ["已結案", data.records.length - openRecords().length, "查看複查與結案紀錄", "tracking/closed", "track", "blue"],
  ];
  return heading("工地總覽", "掌握今日施工、巡檢缺失與改善進度。", btnLink("inspection", "新增巡檢", "plus", true)) +
    `<div class="stats">${stats.map(([name, count, caption, route, symbol, color]) => `
      <a class="stat" href="#${route}"><span class="stat-top">${name}<span class="stat-icon ${color}">${icon(symbol)}</span></span><strong>${count}</strong><small>${caption}</small></a>`).join("")}</div>
    <div class="dashboard"><div class="stack">
      ${panel("今日施工", table(["工項／位置", "施工內容", "施工班組", "狀態", "操作"], work.map((entry) => [
        `<strong>${el(entry.title)}</strong><small class="muted">${el([entry.type, constructionZone.name, entry.location].filter(Boolean).join(" · "))}</small>`,
        entry.description ? `<span class="preview-text">${el(entry.description)}</span>` : '<span class="muted">—</span>',
        el(entry.owner), badge(entry.status, workStatus[entry.status]),
        sampleWorkIds.has(entry.id) ? "" : `<button type="button" class="btn slim" data-edit-work="${el(entry.id)}" aria-label="編輯工項 ${el(entry.title)}">編輯</button>`,
      ]), "今天尚未登錄工項。"), '<button type="button" class="btn slim" data-work>新增工項</button>', "calendar")}
      ${panel("近期巡檢缺失", table(["缺失事項", "改善期限", "狀態"], recentRecords().slice(0, 5).map((record) => [
        `${recordButton(record)}<small class="muted">${constructionZone.name} · ${el(record.location)}</small>`,
        el(record.due), badge(issueStatus(record)),
      ]), "目前沒有巡檢缺失紀錄。"), btnLink("tracking", "全部缺失"), "inspect")}</div>
      <div class="stack"><section class="panel risk"><div class="section-head"><h2>${icon("shield")} 今日風險提醒</h2></div>
        ${work.length ? `<ul>${work.map((entry) => `<li><strong>${el(entry.title)} · ${constructionZone.name}</strong>
        ${el(hazardTips[entry.type] ?? hazardTips[entry.title] ?? "請現場人員確認作業環境、人員分工與防護措施。")}</li>`).join("")}</ul>` :
        '<p class="empty">登錄今日工項後顯示提醒。</p>'}
        <p class="muted">請由現場人員確認檢核提示是否適用。</p></section>
      ${panel("工區示意圖", siteMap(), btnLink("map", "開啟工區圖"), "map")}</div></div>`;
}
function siteMap(interactive = false) {
  const image = '<img src="./worksite-map.jpg" width="2213" height="1440" alt="臺南市安定區周邊地圖，淺藍色標示本工程第 2 標工區">';
  return `<figure class="site-map">
    ${interactive ? `<div class="site-map-image">${image}
      <button type="button" class="site-map-zone" data-show-zone aria-controls="zone-details">
        <span class="site-map-area site-map-area-main" aria-hidden="true"></span>
        <span class="site-map-area site-map-area-north" aria-hidden="true"></span>
        <span class="site-map-label">${constructionZone.name}</span>
      </button></div>` : `<a class="site-map-image" href="./worksite-map.jpg" target="_blank" rel="noopener" aria-label="在新分頁開啟完整工區示意圖">${image}</a>`}
    <figcaption><span class="site-map-key"><span class="site-map-swatch" aria-hidden="true"></span>淺藍色區域為本工程第 2 標工區</span>
      ${interactive ? '<a href="./worksite-map.jpg" target="_blank" rel="noopener">開啟原圖</a>' : ""}</figcaption>
  </figure>`;
}
function mapPage() {
  return heading("工區圖", "點選地圖上的淺藍色工區，查看施工與巡檢紀錄。", '<button type="button" class="btn primary" data-work>新增工項</button>') +
    `<div class="stack">${panel("施工與巡檢分區", siteMap(true), "", "map")}
      <section class="panel" id="zone-details" aria-labelledby="zone-details-title">${zoneDetails()}</section></div>`;
}
function zoneWorkItems(work) {
  return work.map((entry) =>
    `<li><div>${el(entry.title)}<small>${el(entry.location)}</small>${entry.description ? `<small class="preview-text">${el(entry.description)}</small>` : ""}</div>${badge(entry.status, workStatus[entry.status])}</li>`
  ).join("") || '<li class="muted">本區今天無施工紀錄。</li>';
}
function zoneDetails() {
  return `<div class="section-head"><h2 id="zone-details-title" tabindex="-1">${constructionZone.name}</h2>${btnLink("inspection", "通報缺失", "plus")}</div>
    <ul class="zone-list"><li><strong>今日施工</strong></li>${zoneWorkItems(workToday())}
    <li><strong>巡檢缺失</strong></li>${recentRecords().map((entry) =>
      `<li><div>${recordButton(entry)}<small>${el(entry.location)}</small></div>${badge(issueStatus(entry))}</li>`).join("") || '<li class="muted">本區無巡檢缺失。</li>'}</ul>`;
}
function openWork(id) {
  const existing = id ? data.work.find((entry) => entry.id === id) : null;
  if (id && (!existing || sampleWorkIds.has(id))) return;
  const categories = existing?.type && !workCategories.includes(existing.type) ? [existing.type, ...workCategories] : workCategories;
  dialogContent.innerHTML = `<div class="section-head"><h2 id="dialog-title">${existing ? "編輯施工工項" : "新增施工工項"}</h2><button class="btn slim" data-close>關閉</button></div>
    <form id="work-form"><div class="form-grid">
      <label class="field">工項名稱<input name="title" required maxlength="100"></label>
      <label class="field">工程類別<select name="type"><option value="">其他</option>${categories.map((category) => `<option>${el(category)}</option>`).join("")}</select></label>
      <label class="field">施工日期<input name="date" type="date" value="${today}" required></label>
      <label class="field">工區<input value="${el(constructionZone.name)}" readonly></label>
      <label class="field">樁號或設施編號<input name="location" required maxlength="100"></label>
      <label class="field">施工班組<input name="owner" required maxlength="80"></label>
      <label class="field">施工狀態<select name="status">${Object.entries(workStatus).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
      <label class="field full">施工內容（選填）<textarea name="description" maxlength="1000"></textarea></label>
    </div><div class="actions">
      <button class="btn primary">儲存工項</button>
      ${existing ? '<button type="button" class="btn danger" data-delete-work>刪除工項</button>' : ""}
    </div></form>`;
  const form = dialogContent.querySelector("form");
  if (existing) {
    for (const key of ["title", "type", "date", "location", "owner", "status", "description"]) {
      form.elements[key].value = existing[key] ?? "";
    }
    form.querySelector("[data-delete-work]").addEventListener("click", () => {
      if (savingForm || !window.confirm(`確定刪除「${existing.title}」？刪除後無法復原。`)) return;
      commitForm(form, () => saveWork(data.work.filter((entry) => entry.id !== id), "已刪除施工工項。"));
    });
  }
  showDialog();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(form, async () => {
      const entry = { ...existing, ...Object.fromEntries(new FormData(form)) };
      for (const key of ["title", "location", "owner"]) entry[key] = requireText(entry[key]);
      entry.description = entry.description.trim();
      if (existing) {
        await saveWork(data.work.map((item) => item.id === id ? entry : item), "已更新施工工項。");
      } else {
        entry.zone = constructionZone.id;
        entry.id = crypto.randomUUID();
        await saveWork([...data.work, entry], "已新增施工工項。");
      }
    });
  });
}
async function saveWork(work, message) {
  await save({ ...data, work });
  dialog.close();
  render(true);
  notify(message);
}
function showDialog() {
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.showModal();
}
function requireText(value) {
  const normalized = value.trim();
  if (!normalized) throw new Error("請填寫所有必填欄位。");
  return normalized;
}

const positionCoordinates = ({ latitude, longitude }) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
function positionDetails(position) {
  const coordinates = positionCoordinates(position);
  const time = new Intl.DateTimeFormat("zh-TW", { dateStyle:"medium", timeStyle:"medium" }).format(position.timestamp);
  return `<div class="gps-details">
    <dl><div><dt>緯度、經度</dt><dd>${coordinates}</dd></div>
      <div><dt>位置來源</dt><dd>${position.source === "map" ? "地圖選點" : "裝置定位"}</dd></div>
      ${position.source === "map" ? "" : `<div><dt>精度半徑</dt><dd>約 ${Math.ceil(position.accuracy)} 公尺</dd></div>`}
      <div><dt>選取時間</dt><dd>${el(time)}</dd></div></dl>
    <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${position.latitude},${position.longitude}`)}" target="_blank" rel="noopener noreferrer">在 Google 地圖查看位置</a>
  </div>`;
}
function currentDraft(form) {
  const { before, ...fields } = Object.fromEntries(new FormData(form));
  return { ...fields, zone:constructionZone.id, before:inspectionView?.before ?? [], position:inspectionView?.position ?? null };
}
function inspectionPage() {
  if (!inspectionView) {
    const saved = data.draft;
    inspectionView = saved ? { ...saved, notes:saved.notes?.trim() ? saved.notes : saved.raw ?? "" }
      : { date:today, due:today, before:[] };
  }
  const draft = inspectionView;
  const field = (key) => el(draft[key]);
  const projectName = el(document.querySelector("#project-name").textContent);
  const topics = draft.title && !inspectionTopics.includes(draft.title) ? [draft.title, ...inspectionTopics] : inspectionTopics;
  return heading("巡檢通報", "填寫缺失位置、通報內容與改善責任，再確認送出。") +
    `<form id="inspection-form" class="stack inspection-form">
    ${panel("缺失地點", `<div class="inspection-location">
      <div class="form-grid">
        <div class="field full"><span>工程名稱</span><p class="inspection-project">${projectName}</p></div>
        <label class="field">工區<input value="${constructionZone.name}" readonly></label>
        <label class="field">巡檢日期<input name="date" type="date" value="${field("date")}" required></label>
        <label class="field full">樁號或設施編號<input name="location" value="${field("location")}" placeholder="例如 K0+230 或 DR-07"${draft.position ? "" : " required"} maxlength="100"><small>選取地圖位置或完成定位後，此欄可選填。</small></label>
      </div>
      <section class="inspection-gps" aria-labelledby="gps-heading">
        <h3 id="gps-heading">${icon("locate")}缺失位置地圖</h3>
        <p class="field-note" id="inspection-map-help">點選地圖上的缺失地點，或站在現場取得目前位置。</p>
        <div class="inspection-map" data-location-map role="region" aria-label="選取缺失地點" aria-describedby="inspection-map-help"></div>
        <p class="field-note" role="status" data-map-status>正在載入地圖…</p>
        <div class="gps-actions"><button type="button" class="btn primary" data-locate>取得目前位置</button>
          <button type="button" class="btn" data-clear-location${draft.position ? "" : " hidden"}>清除位置</button></div>
        <p class="field-note" role="status" data-gps-status>${draft.position ? "已保留先前選取的位置。" : "尚未選取位置"}</p>
        <div data-gps-result>${draft.position ? positionDetails(draft.position) : ""}</div>
      </section>
    </div>`, "", "map")}
    ${panel("通報內容", `<div class="form-grid">
      <label class="field full">通報主題<select name="title" required><option value="">請選擇職安缺失</option>${topics.map((topic) =>
        `<option value="${el(topic)}"${topic === draft.title ? " selected" : ""}>${el(topic)}</option>`).join("")}</select></label>
      <label class="field full">通報內容<textarea name="notes" placeholder="請描述現場看到的職安衛缺失，以及需要改善的事項。" required maxlength="4000">${field("notes")}</textarea></label>
    </div>`, "", "inspect")}
    ${panel("改善責任", `<div class="form-grid">
      <label class="field">改善負責人<input name="owner" value="${field("owner")}" required maxlength="80"></label>
      <label class="field">改善期限<input name="due" type="date" value="${field("due")}" required></label>
    </div>`, "", "track")}
    ${panel("現場照片", `<div class="form-grid">
      <label class="field full">選擇照片<input name="before" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>手機可選擇相機或照片。每次最多 5 張，每張最多 8 MB。</small></label>
      <div class="full" id="before-preview">${photos(draft.before)}</div>
    </div>`, "", "camera")}
    ${panel("確認送出", `<div class="form-grid">
      <label class="full"><input type="checkbox" name="verified" value="yes" required> 我已核對紀錄並確認送交改善追蹤</label>
      <p class="field-note full">送出後，紀錄會儲存在此瀏覽器，並出現在「改善追蹤」。</p>
    </div><div class="actions"><button type="button" class="btn" data-save-draft>儲存草稿</button><button type="submit" class="btn primary">確認並送出</button></div>`, "", "report")}
    </form>`;
}
function loadInspectionMapLibrary() {
  if (inspectionMapLibrary) return inspectionMapLibrary;
  const base = "https://unpkg.com/leaflet@1.9.4/dist/leaflet";
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = `${base}.css`;
  stylesheet.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  const script = document.createElement("script");
  script.src = `${base}.js`;
  script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

  inspectionMapLibrary = Promise.all([stylesheet, script].map((asset) => new Promise((resolve, reject) => {
    asset.crossOrigin = "anonymous";
    asset.onload = resolve;
    asset.onerror = reject;
    document.head.append(asset);
  }))).then(() => window.L).catch((error) => {
    stylesheet.remove();
    script.remove();
    inspectionMapLibrary = null;
    throw error;
  });
  return inspectionMapLibrary;
}

async function bindInspectionMap(form, choosePoint) {
  const container = form.querySelector("[data-location-map]");
  const status = form.querySelector("[data-map-status]");
  try {
    const leaflet = await loadInspectionMapLibrary();
    if (!form.isConnected) return;
    const initial = inspectionView?.position;
    const center = initial ? [initial.latitude, initial.longitude] : worksiteCenter;
    const map = leaflet.map(container, { scrollWheelZoom:false, doubleClickZoom:false }).setView(center, initial ? 17 : 16);
    activeInspectionMap = map;
    const tiles = leaflet.tileLayer("https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}", {
      attribution:'<a href="https://maps.nlsc.gov.tw/">內政部國土測繪中心</a>', maxZoom:19, noWrap:true,
    });
    let tilesVisible = false;
    tiles.on("loading", () => { tilesVisible = false; });
    tiles.on("tileload", () => { tilesVisible = true; });
    tiles.on("load", () => {
      status.hidden = tilesVisible;
      status.textContent = tilesVisible ? "" : "目前無法載入地圖，仍可使用裝置定位或手動填寫位置。";
    }).addTo(map);

    const marker = leaflet.marker(center, {
      interactive:false, keyboard:false,
      icon:leaflet.divIcon({ className:"inspection-pin", html:'<span aria-hidden="true"></span>', iconSize:[24, 32], iconAnchor:[12, 30] }),
    });
    function selectPoint(point) {
      if (!tilesVisible) return;
      const { lat, lng } = point.wrap();
      choosePoint(lat, lng);
    }
    map.on("click", (event) => selectPoint(event.latlng));
    container.addEventListener("keydown", (event) => {
      if (event.target !== container || event.key !== "Enter") return;
      event.preventDefault();
      selectPoint(map.getCenter());
    });

    return (position, recenter = false) => {
      if (!position) { marker.remove(); return; }
      const point = [position.latitude, position.longitude];
      marker.setLatLng(point).addTo(map);
      if (recenter) map.setView(point, Math.max(17, map.getZoom()));
    };
  } catch {
    if (!form.isConnected) return;
    container.hidden = true;
    status.textContent = "地圖無法載入，仍可使用裝置定位或手動填寫位置。";
  }
}

function bindInspectionLocation(form) {
  const locate = form.querySelector("[data-locate]");
  const clear = form.querySelector("[data-clear-location]");
  const status = form.querySelector("[data-gps-status]");
  const result = form.querySelector("[data-gps-result]");
  let request = null;
  let drawPosition = () => {};

  function showPosition(position, message, recenter = false) {
    inspectionView = { ...currentDraft(form), position };
    form.elements.location.required = !position;
    result.innerHTML = position ? positionDetails(position) : "";
    status.textContent = message;
    clear.textContent = "清除位置";
    clear.hidden = !position;
    drawPosition(position, recenter);
  }

  bindInspectionMap(form, (latitude, longitude) => {
    request = null;
    locate.disabled = false;
    showPosition({ latitude, longitude, timestamp:Date.now(), source:"map" }, "已標記地圖上的缺失地點。");
  }).then((draw) => {
    if (!draw || !form.isConnected) return;
    drawPosition = draw;
    drawPosition(inspectionView?.position);
  });

  locate.addEventListener("click", () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      status.textContent = "目前網頁無法使用定位。請使用 HTTPS 開啟，或手動填寫位置。";
      return;
    }
    const attempt = Symbol();
    request = attempt;
    locate.disabled = true;
    clear.hidden = false;
    clear.textContent = "取消定位";
    status.textContent = "正在取得位置，請允許瀏覽器使用定位。";

    function finish(position, message, recenter = false) {
      if (request !== attempt || !form.isConnected) return;
      request = null;
      locate.disabled = false;
      showPosition(position, message, recenter);
    }

    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      const { latitude, longitude, accuracy } = coords;
      finish({ latitude, longitude, accuracy, timestamp, source:"gps" }, "已取得目前位置。", true);
    }, ({ code }) => {
      const messages = {
        1:"未取得定位權限。請允許瀏覽器使用位置，或手動填寫位置。",
        2:"目前無法取得位置。請到開闊處重試，或手動填寫位置。",
        3:"定位逾時。請重試，或手動填寫位置。",
      };
      finish(inspectionView?.position ?? null, messages[code] ?? messages[2]);
    }, { enableHighAccuracy:true, maximumAge:0, timeout:15000 });
  });

  clear.addEventListener("click", () => {
    const cancelling = request !== null;
    request = null;
    locate.disabled = false;
    showPosition(cancelling ? inspectionView?.position ?? null : null, cancelling ? "已取消這次定位。" : "已清除缺失位置。");
    locate.focus();
  });

  return () => request !== null;
}
function bindInspection() {
  const form = main.querySelector("#inspection-form");
  const isLocating = bindInspectionLocation(form);
  form.addEventListener("input", () => { inspectionView = currentDraft(form); });
  form.elements.before.addEventListener("change", async () => {
    const input = form.elements.before;
    const selected = [...input.files];
    if (!selected.length) return;
    try {
      const images = await imageList(selected);
      if (form.isConnected) {
        inspectionView.before = images;
        form.querySelector("#before-preview").innerHTML = photos(images);
      }
    } catch (error) {
      notify(error.message);
    } finally {
      input.value = "";
    }
  });
  form.querySelector("[data-save-draft]").addEventListener("click", () => {
    if (isLocating()) { notify("請等定位完成，或先取消定位。"); return; }
    commitForm(form, async () => {
      if (form.elements.before.files.length) throw new Error("照片讀取中，請稍候再儲存。");
      inspectionView = currentDraft(form);
      await save({ ...data, draft:inspectionView });
      notify("草稿已儲存在此瀏覽器。");
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isLocating()) { notify("請等定位完成，或先取消定位。"); return; }
    commitForm(form, async () => {
      if (form.elements.before.files.length) throw new Error("照片讀取中，請稍候再送出。");
      const draft = currentDraft(form);
      for (const key of ["title", "notes", "owner"]) draft[key] = requireText(draft[key]);
      const manualLocation = draft.location.trim();
      draft.location = draft.position ? manualLocation || positionCoordinates(draft.position) : requireText(manualLocation);
      if (draft.due < draft.date) throw new Error("改善期限須在巡檢日期當天或之後。");
      const { verified, ...fields } = draft;
      const id = `巡-${String(data.nextId).padStart(4, "0")}`;
      await save({
        ...data, nextId:data.nextId + 1, draft:null,
        records:[...data.records, { ...fields, id, status:"open", during:[], after:[], reviews:[] }],
      });
      inspectionView = null;
      notify(`${id} 已送交改善追蹤。`);
      location.hash = "tracking";
    });
  });
}

const filters = { all:"全部狀態", open:"未結案", progress:"改善中", review:"待複查", late:"逾期", closed:"已結案" };
function trackingPage() {
  return heading("改善追蹤", "管理改善責任、期限與照片，並登錄複查結果。", btnLink("inspection", "新增巡檢", "plus", true)) +
    `<section class="panel"><div class="filter">
      <label class="field search">搜尋缺失<input type="search" id="query" placeholder="缺失標題、編號、位置或負責人"></label>
      <label class="field">狀態<select id="status-filter">${Object.entries(filters).map(([key, label]) =>
        `<option value="${key}"${trackingFilter === key ? " selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <div id="tracking-results">${trackingRows()}</div></section>`;
}
function trackingRows(query = "") {
  const records = recentRecords().filter((record) => {
    const matches = trackingFilter === "all" ||
      (trackingFilter === "open" ? record.status !== "closed" :
        trackingFilter === "late" ? issueStatus(record) === "late" : record.status === trackingFilter);
    return matches && [record.title, record.id, record.location, record.owner, constructionZone.name]
      .some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  });
  return table(["缺失事項", "位置", "負責人", "改善期限", "狀態"], records.map((record) => [
    `${recordButton(record)}<small class="muted">${el(record.id)} · ${el(record.date)}</small>`,
    `${constructionZone.name}<small class="muted">${el(record.location)}</small>`,
    el(record.owner), el(record.due), `${badge(record.status)}${issueStatus(record) === "late" ? ` ${badge("late")}` : ""}`,
  ]));
}
function openRecord(id) {
  const record = data.records.find((entry) => entry.id === id);
  if (!record) return;
  const closed = record.status === "closed";
  const canReview = record.status === "review";
  dialogContent.innerHTML = `<div class="section-head"><div><h2 id="dialog-title">${el(record.title)}</h2>
    <small class="muted">${el(id)} · ${record.date}</small></div><div class="actions">
      ${currentPage === "tracking" ? '<button type="button" class="btn slim" data-delete-record>刪除紀錄</button>' : ""}
      <button class="btn slim" data-close>關閉</button></div></div>
    <div class="info"><p>${badge(record.status)} ${issueStatus(record) === "late" ? badge("late") : ""}</p>
    <p><strong>位置</strong> ${constructionZone.name}${record.position && record.location === positionCoordinates(record.position) ? "" : ` · ${el(record.location)}`}</p>
    ${record.position ? positionDetails(record.position) : ""}<p class="preview-text">${el(record.notes)}</p></div>
    <h3>改善前照片</h3>${photos(record.before)}
    <h3>改善中</h3>${record.duringNotes ? `<p class="preview-text">${el(record.duringNotes)}</p>` : ""}${photos(record.during ?? [])}
    <h3>改善後</h3>${record.afterNotes ? `<p class="preview-text">${el(record.afterNotes)}</p>` : ""}${photos(record.after)}
    <h3>複查紀錄</h3>${record.reviews.length ? table(["日期", "複查人員", "結果", "紀錄"], record.reviews.map((review) => [
      el(review.date), el(review.reviewer), review.passed ? "通過並結案" : "退回改善", el(review.notes),
    ])) : '<p class="field-note">尚無複查紀錄</p>'}
    ${closed ? `<p class="note status">負責人 ${el(record.owner)} · 改善期限 ${el(record.due)}</p>` : `
    <h3>更新改善進度</h3><form id="update-record"><div class="form-grid">
      <label class="field">改善負責人<input name="owner" value="${el(record.owner)}" required maxlength="80"></label>
      <label class="field">改善期限<input name="due" type="date" min="${record.date}" value="${el(record.due)}" required></label>
      <label class="field">處理狀態<select name="status">${["open","progress","review"].map((key) =>
        `<option value="${key}"${record.status === key ? " selected" : ""}>${statusNames[key]}</option>`).join("")}</select></label>
      <label class="field full">改善中說明<textarea name="duringNotes" maxlength="4000">${el(record.duringNotes)}</textarea></label>
      <label class="field full">新增改善中照片<input type="file" name="during" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>每次最多 5 張，每張最多 8 MB。</small></label>
      <label class="field full">改善後說明<textarea name="afterNotes" maxlength="4000">${el(record.afterNotes)}</textarea></label>
      <label class="field full">新增改善後照片<input type="file" name="after" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>每次最多 5 張，每張最多 8 MB。</small></label>
    </div><div class="actions"><button class="btn primary">儲存改善進度</button></div></form>
    ${canReview ? `<h3>登錄複查結果</h3><form id="review-record"><div class="form-grid">
      <label class="field">複查人員<input name="reviewer" required maxlength="80"></label>
      <label class="field">複查結果<select name="result" required><option value="">請選擇</option><option value="return">退回改善</option><option value="pass">通過並結案</option></select></label>
      <label class="field full">複查說明<textarea name="notes" required maxlength="4000"></textarea></label>
      <label class="full"><input type="checkbox" required> 我已核對現場狀況並確認複查結果</label>
    </div><div class="actions"><button class="btn primary">確認複查結果</button></div></form>` : ""}`}`;
  showDialog();
  const update = dialogContent.querySelector("#update-record");
  const review = dialogContent.querySelector("#review-record");
  dialogContent.querySelector("[data-delete-record]")?.addEventListener("click", () => {
    if (savingForm || !window.confirm(`確定刪除「${id} ${record.title}」及其照片與複查紀錄？刪除後無法復原。`)) return;
    commitForm(dialogContent, async () => {
      await save({ ...data, records:data.records.filter((entry) => entry.id !== id) });
      refreshAfterRecordChange();
      notify("已刪除巡檢缺失紀錄。");
    });
  });
  update?.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(update, async () => {
      const form = new FormData(update);
      const [duringPhotos, afterPhotos] = await Promise.all([imageList(update.elements.during.files), imageList(update.elements.after.files)]);
      const duringNotes = form.get("duringNotes").trim();
      const afterNotes = form.get("afterNotes").trim();
      const during = [...(record.during ?? []), ...duringPhotos];
      const after = [...record.after, ...afterPhotos];
      await saveRecord({ ...record, owner:requireText(form.get("owner")), due:form.get("due"), status:form.get("status"),
        during, duringNotes, duringDate:duringPhotos.length || duringNotes !== (record.duringNotes ?? "") ? dateKey() : record.duringDate,
        after, afterNotes, afterDate:afterPhotos.length || afterNotes !== (record.afterNotes ?? "") ? dateKey() : record.afterDate });
      notify("已更新改善進度。");
    });
  });
  review?.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(review, async () => {
      const form = new FormData(review);
      const passed = form.get("result") === "pass";
      const entry = { date:today, reviewer:requireText(form.get("reviewer")), passed, notes:requireText(form.get("notes")) };
      await saveRecord({ ...record, status:passed ? "closed" : "progress", reviews:[...record.reviews, entry] });
      notify(passed ? "複查通過，缺失已結案。" : "已登錄複查結果並退回改善。");
    });
  });
}
async function saveRecord(record) {
  await save({ ...data, records:data.records.map((entry) => entry.id === record.id ? record : entry) });
  refreshAfterRecordChange();
}
function refreshAfterRecordChange() {
  dialog.close();
  if (currentPage === "tracking") {
    main.querySelector("#tracking-results").innerHTML = trackingRows(main.querySelector("#query").value);
  } else {
    render();
  }
}

function reportPage() {
  return heading("報表匯出", "依日期篩選施工、巡檢與缺失紀錄，匯出 CSV、列印，或下載缺失改善照片表。") +
    `<section class="panel" id="report-panel">
    <div class="section-head report-actions"><div class="tabs" aria-label="報表種類">${[
      ["inspection","巡檢紀錄"], ["work","施工紀錄"], ["issues","缺失改善"], ["weekly","每週職安摘要"],
    ].map(([key, label]) => `<button type="button" class="btn" data-report="${key}" aria-pressed="${reportType === key}">${label}</button>`).join("")}</div></div>
    <form class="filter" id="report-filters">
      <label class="field">起始日期<input name="from" type="date" value="${el(reportFrom)}" required></label>
      <label class="field">結束日期<input name="to" type="date" value="${el(reportTo)}" min="${el(reportFrom)}" required></label>
      <button class="btn primary" type="submit">${icon("download")}下載 CSV</button>
      <button class="btn" type="button" data-print>列印／PDF</button>
    </form><div id="report-preview">${reportPreview()}</div></section>`;
}
function reportRows() {
  const inRange = (date) => date >= reportFrom && date <= reportTo;
  if (reportType === "work") {
    const work = data.work.filter((entry) => inRange(entry.date)).sort((a, b) => b.date.localeCompare(a.date));
    return {
      title:"施工紀錄",
      headers:["施工日期", "工區", "樁號／設施", "工項名稱", "工程類別", "施工班組", "施工狀態", "施工內容"],
      rows:work.map((entry) => [
        entry.date, constructionZone.name, entry.location,
        sampleWorkIds.has(entry.id) ? `${entry.title}（範例）` : entry.title,
        entry.type ?? "", entry.owner, workStatus[entry.status], entry.description ?? "",
      ]),
    };
  }
  const records = recentRecords().filter((record) => inRange(record.date));
  if (reportType === "inspection") return {
    title:"巡檢紀錄",
    headers:["編號", "巡檢日期", "工區", "樁號／設施", "缺失標題", "缺失與改善要求", "照片張數"],
    rows:records.map((record) => [record.id, record.date, constructionZone.name, record.location, record.title, record.notes, record.before.length]),
  };
  if (reportType === "issues") return {
    title:"缺失改善報表", records,
    headers:["編號", "巡檢日期", "工區", "樁號／設施", "缺失標題", "改善負責人", "改善期限", "處理狀態", "逾期", "改善前照片張數", "改善後照片張數", "複查紀錄"],
    rows:records.map((record) => [
      record.id, record.date, constructionZone.name, record.location, record.title, record.owner, record.due, statusNames[record.status],
      issueStatus(record) === "late" ? "是" : "否", record.before.length, record.after.length,
      record.reviews.map((review) => `${review.date} ${review.reviewer} ${review.passed ? "通過" : "退回"}　${review.notes}`).join("\n"),
    ]),
  };
  const count = (predicate) => records.filter(predicate).length;
  return {
    title:"每週職安摘要",
    headers:["統計項目", "件數"],
    rows:[
      ["期間登錄工項", data.work.filter((entry) => inRange(entry.date)).length],
      ["期間登錄巡檢缺失", records.length],
      ["期間登錄缺失中，目前未結案", count((record) => record.status !== "closed")],
      ["期間登錄缺失中，目前逾期", count((record) => issueStatus(record) === "late")],
      ["期間複查通過並結案", data.records.filter((record) => record.reviews.some((review) => review.passed && inRange(review.date))).length],
    ],
  };
}
function reportPreview() {
  if (!(reportFrom && reportTo && reportFrom <= reportTo)) return '<p class="empty">請輸入有效的報表日期範圍。</p>';
  const { title, headers, rows, records } = reportRows();
  return `${records ? improvementExportForm(records) : ""}<div class="section-head"><h2>${title}</h2></div><p class="report-meta">${el(reportFrom)} 至 ${el(reportTo)}${reportType === "weekly" ? "" : ` · 共 ${rows.length} 筆`}</p>${table(headers, rows.map((row) => row.map((value) => `<span class="preview-text">${el(value)}</span>`))) }`;
}
function improvementExportForm(records) {
  return `<form id="improvement-export" class="filter improvement-export">
    <label class="field search">缺失改善照片表<select name="record" required${records.length ? "" : " disabled"}>
      <option value="">${records.length ? "請選擇缺失紀錄" : "所選日期內沒有缺失紀錄"}</option>
      ${records.map((record) => `<option value="${el(record.id)}">${el(`${record.id} · ${record.date} · ${record.title}`)}</option>`).join("")}
    </select></label>
    <button type="submit" class="btn primary"${records.length ? "" : " disabled"}>${icon("download")}下載 Word</button>
  </form>`;
}
function csvCell(value) {
  let content = String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(content)) content = "'" + content;
  return '"' + content.replace(/"/g, '""') + '"';
}
function downloadReport() {
  const { title, headers, rows } = reportRows();
  const lines = reportType === "weekly"
    ? [headers, ["統計期間", `${reportFrom} 至 ${reportTo}`], ...rows]
    : [headers, ...rows];
  const csv = lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type:"text/csv;charset=utf-8" });
  downloadBlob(blob, `${title}_${reportFrom}_${reportTo}.csv`);
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bindReport() {
  const form = main.querySelector("#report-filters");
  const preview = main.querySelector("#report-preview");
  form.addEventListener("input", () => {
    reportFrom = form.elements.from.value;
    reportTo = form.elements.to.value;
    form.elements.to.min = reportFrom;
    preview.innerHTML = reportPreview();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    downloadReport();
  });
  form.querySelector("[data-print]").addEventListener("click", () => {
    if (form.reportValidity()) window.print();
  });
  preview.addEventListener("submit", (event) => {
    const exportForm = event.target;
    if (exportForm.id !== "improvement-export") return;
    event.preventDefault();
    const record = data.records.find((entry) => entry.id === exportForm.elements.record.value);
    if (!record) return;
    commitForm(exportForm, async () => {
      const projectName = document.querySelector("#project-name").textContent.trim();
      const docx = await createImprovementDocument(record, projectName);
      downloadBlob(docx, `缺失改善照片表_${record.id}.docx`);
    });
  });
}
function render(focus = false) {
  activeInspectionMap?.remove();
  activeInspectionMap = null;
  const [route, detail] = location.hash.slice(1).split("/");
  const target = pages.find(([key]) => key === route)?.[0] ?? "overview";
  currentPage = target;
  document.querySelector("#nav").innerHTML = pages.map(([key, label, symbol]) =>
    `<a href="#${key}"${key === target ? ' aria-current="page"' : ""}>${icon(symbol)}${label}</a>`).join("");
  switch (target) {
    case "map":
      main.innerHTML = mapPage();
      break;
    case "inspection":
      main.innerHTML = inspectionPage();
      bindInspection();
      break;
    case "tracking":
      trackingFilter = Object.hasOwn(filters, detail) ? detail : "all";
      main.innerHTML = trackingPage();
      const update = () => {
        trackingFilter = main.querySelector("#status-filter").value;
        main.querySelector("#tracking-results").innerHTML = trackingRows(main.querySelector("#query").value);
      };
      main.querySelector("#query").addEventListener("input", update);
      main.querySelector("#status-filter").addEventListener("change", update);
      break;
    case "reports":
      main.innerHTML = reportPage();
      bindReport();
      break;
    default:
      main.innerHTML = overview();
  }
  if (focus) main.focus();
}
main.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !data) return;
  if (button.hasAttribute("data-work")) openWork();
  if (button.dataset.editWork) openWork(button.dataset.editWork);
  if (button.dataset.record) openRecord(button.dataset.record);
  if (button.hasAttribute("data-show-zone")) main.querySelector("#zone-details-title").focus();
  if (button.dataset.report) {
    reportType = button.dataset.report;
    main.querySelectorAll("[data-report]").forEach((entry) => entry.setAttribute("aria-pressed", entry === button));
    main.querySelector("#report-preview").innerHTML = reportPreview();
  }
});
dialog.addEventListener("click", (event) => {
  if (!savingForm && event.target.closest("[data-close]")) dialog.close();
});
dialog.addEventListener("cancel", (event) => { if (savingForm) event.preventDefault(); });
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", () => { if (data) render(true); });
document.querySelectorAll("[data-icon]").forEach((item) => { item.innerHTML = icon(item.dataset.icon); });
const dateElement = document.querySelector("#today");
dateElement.dateTime = today;
dateElement.textContent = new Intl.DateTimeFormat("zh-TW", { dateStyle:"full" }).format(new Date());

function loadWorkspace() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("workspace", "readwrite");
    const store = transaction.objectStore("workspace");
    const read = store.get("data");
    let workspace;
    read.onsuccess = () => {
      const saved = read.result;
      const records = saved?.records.filter((record) => !sampleRecordIds.has(record.id));
      workspace = saved;
      if (!saved) {
        workspace = { ...initialData(), revision:1 };
        store.put(workspace, "data");
      } else if (!saved.legacyDraftCleared || records.length !== saved.records.length) {
        workspace = {
          ...saved,
          records,
          draft:saved.legacyDraftCleared ? saved.draft : null,
          legacyDraftCleared:true,
          revision:(saved.revision ?? 0) + 1,
        };
        store.put(workspace, "data");
      }
    };
    transaction.oncomplete = () => resolve(workspace);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function init() {
  try {
    db = await openDatabase();
    data = await loadWorkspace();
    render();
  } catch {
    main.innerHTML = heading("無法開啟工作區", "請確認瀏覽器允許此網站儲存資料，重新載入後再試。");
  }
}
init();
