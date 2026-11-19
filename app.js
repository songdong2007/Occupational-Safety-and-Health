"use strict";

const icons = {
  shield: '<path d="M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
  inspect: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6m-6 5h6"/>',
  track: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 12 2 2 4-4m2 4h2"/>',
  report: '<path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6m-6 4h6"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  building: '<path d="M3 21h18M5 21V9h5v12m0 0V3h8v18m-5-14h2m-2 4h2m-2 4h2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  alert: '<path d="M12 3 2 20h20L12 3Zm0 7v4m0 3v.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const pages = [
  ["overview", "工地總覽", "home"], ["map", "工區圖", "map"],
  ["inspection", "巡檢通報", "inspect"], ["tracking", "改善追蹤", "track"],
  ["reports", "報表匯出", "report"],
];
const zones = [
  { id:"A", name:"A 區 · 北段", station:"K0+000–K0+450", facilities:"MH-03、DR-07" },
  { id:"B", name:"B 區 · 中段", station:"K0+450–K0+900", facilities:"MH-11、TC-02" },
  { id:"C", name:"C 區 · 南段", station:"K0+900–K1+350", facilities:"MH-16、BR-01" },
];
const statusNames = { open:"待處理", progress:"改善中", review:"待複查", closed:"已結案", late:"逾期" };
const workStatus = { scheduled:"未開始", progress:"施工中", closed:"已完成" };
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
function zoneName(id) {
  return zones.find((zone) => zone.id === id)?.name ?? id;
}
function issueStatus(record) {
  return record.status !== "closed" && record.due < today ? "late" : record.status;
}
function sampleData() {
  return {
    work: [
      { id:"W01", title:"排水開挖", zone:"A", location:"K0+230 · DR-07", owner:"土木班", date:today, status:"progress" },
      { id:"W02", title:"交維設施", zone:"B", location:"K0+670 · TC-02", owner:"交維班", date:today, status:"progress" },
      { id:"W03", title:"路面鋪設", zone:"C", location:"K1+120", owner:"鋪面班", date:today, status:"scheduled" },
    ],
    records: [
      { id:"巡-0001", date:offsetDate(-2), title:"開挖區圍設有缺口", zone:"A", location:"K0+230 · DR-07", notes:"開挖區靠便道側圍設有缺口，請重新固定並確認隔離範圍。", owner:"土木班", due:offsetDate(-1), status:"open", before:[], after:[], reviews:[] },
      { id:"巡-0002", date:offsetDate(-1), title:"臨時導引牌偏移", zone:"B", location:"K0+670 · TC-02", notes:"轉向導引牌偏離行車視線，請調整位置。", owner:"交維班", due:today, status:"progress", before:[], after:[], reviews:[] },
      { id:"巡-0003", date:today, title:"人行通道堆置材料", zone:"C", location:"K1+100 · MH-16", notes:"人行通道需清理並保持暢通。", owner:"鋪面班", due:offsetDate(2), status:"review", before:[], after:[], reviews:[] },
    ],
    nextId:4,
    draft:null,
  };
}
let db;
let data;
let currentPage;
let selectedZone = "A";
let trackingFilter = "all";
let reportType = "inspection";
const weekStartOffset = (new Date().getDay() + 6) % 7;
let reportFrom = offsetDate(-weekStartOffset);
let reportTo = offsetDate(6 - weekStartOffset);
let inspectionView = null;
let speech = null;
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
function storage(mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("workspace", mode);
    const request = callback(transaction.objectStore("workspace"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
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
  return Promise.all([...files].map(async (file) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      throw new Error("請選擇 JPG、PNG、WebP 或 GIF 照片。");
    }
    if (file.size > 8 * 1024 * 1024) throw new Error("每張照片須小於或等於 8 MB。");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name:file.name, url:reader.result });
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
      ${panel("今日施工", table(["工項／位置", "施工班組", "狀態"], work.map((entry) => [
        `<strong>${el(entry.title)}</strong><small class="muted">${el(zoneName(entry.zone))} · ${el(entry.location)}</small>`,
        el(entry.owner), badge(entry.status, workStatus[entry.status]),
      ]), "今天尚未登錄工項。"), '<button type="button" class="btn slim" data-work>新增工項</button>', "calendar")}
      ${panel("近期巡檢缺失", table(["缺失事項", "改善期限", "狀態"], recentRecords().slice(0, 5).map((record) => [
        `${recordButton(record)}<small class="muted">${el(zoneName(record.zone))} · ${el(record.location)}</small>`,
        el(record.due), badge(issueStatus(record)),
      ])), btnLink("tracking", "全部缺失"), "inspect")}</div>
      <div class="stack"><section class="panel risk"><div class="section-head"><h2>${icon("shield")} 今日風險提醒</h2></div>
        ${work.length ? `<ul>${work.map((entry) => `<li><strong>${el(entry.title)} · ${el(zoneName(entry.zone))}</strong>
        ${el(hazardTips[entry.type || entry.title] ?? "請現場人員確認作業環境、人員分工與防護措施。")}</li>`).join("")}</ul>` :
        '<p class="empty">登錄今日工項後顯示提醒。</p>'}
        <p class="muted">依工項類別帶出檢核提示，請由現場人員確認。</p></section>
      ${panel("工區分布", mapDiagram(true), btnLink("map", "開啟工區圖"), "map")}</div></div>`;
}
function mapDiagram(linkOnly = false) {
  return `<div class="map" aria-label="道路工區示意圖">${zones.map((zone) => {
    const count = openRecords().filter((record) => record.zone === zone.id).length;
    const content = `<strong>${el(zone.name)}</strong><span class="pin${count ? " active" : ""}" aria-label="${count} 件未結案缺失">${count}</span><small>${zone.station}</small>`;
    return linkOnly ? `<a class="zone" href="#map/${zone.id}">${content}</a>` :
      `<button type="button" class="zone" data-zone="${zone.id}" aria-pressed="${zone.id === selectedZone}">${content}</button>`;
  }).join("")}</div><div class="legend"><span class="badge late">有未結案缺失</span><span class="badge closed">目前無未結案缺失</span></div>`;
}
function mapPage() {
  return heading("工區圖", "選擇路段，查看施工工項與缺失位置。", '<button type="button" class="btn primary" data-work>新增工項</button>') +
    `<div class="columns">${panel("道路工區示意圖", mapDiagram(), "", "map")}
      <section class="panel" id="zone-details">${zoneDetails()}</section></div>`;
}
function zoneDetails() {
  const zone = zones.find((entry) => entry.id === selectedZone);
  const work = workToday().filter((entry) => entry.zone === zone.id);
  const records = recentRecords().filter((entry) => entry.zone === zone.id);
  return `<div class="section-head"><h2>${el(zone.name)}</h2>${btnLink(`inspection/${zone.id}`, "通報缺失", "plus")}</div>
    <p class="note">樁號 ${zone.station}<br>設施 ${zone.facilities}</p>
    <ul class="zone-list"><li><strong>今日施工</strong></li>${work.map((entry) =>
      `<li><div>${el(entry.title)}<small>${el(entry.location)}</small></div>${badge(entry.status, workStatus[entry.status])}</li>`).join("") || '<li class="muted">本區今天無施工紀錄。</li>'}
    <li><strong>巡檢缺失</strong></li>${records.map((entry) =>
      `<li><div>${recordButton(entry)}<small>${el(entry.location)}</small></div>${badge(issueStatus(entry))}</li>`).join("") || '<li class="muted">本區無巡檢缺失。</li>'}</ul>`;
}
const zoneOptions = (selected) => zones.map((zone) => `<option value="${zone.id}"${selected === zone.id ? " selected" : ""}>${el(zone.name)}</option>`).join("");
function openWork() {
  dialogContent.innerHTML = `<div class="section-head"><h2 id="dialog-title">新增施工工項</h2><button class="btn slim" data-close>關閉</button></div>
    <form id="work-form"><div class="form-grid">
      <label class="field">工項名稱<input name="title" required maxlength="100"></label>
      <label class="field">工項類別<select name="type"><option value="">其他</option>${Object.keys(hazardTips).map((type) => `<option>${type}</option>`).join("")}</select></label>
      <label class="field">施工日期<input name="date" type="date" value="${today}" required></label>
      <label class="field">工區<select name="zone">${zoneOptions(currentPage === "map" ? selectedZone : "A")}</select></label>
      <label class="field">樁號或設施編號<input name="location" required maxlength="100"></label>
      <label class="field">施工班組<input name="owner" required maxlength="80"></label>
      <label class="field">施工狀態<select name="status">${Object.entries(workStatus).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
    </div><div class="actions"><button class="btn primary">儲存工項</button></div></form>`;
  showDialog();
  const form = dialogContent.querySelector("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(form, async () => {
      const entry = Object.fromEntries(new FormData(form));
      for (const key of ["title", "location", "owner"]) entry[key] = requireText(entry[key]);
      entry.id = crypto.randomUUID();
      await save({ ...data, work:[...data.work, entry] });
      dialog.close();
      render();
      notify("已新增施工工項");
    });
  });
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

function currentDraft(form) {
  const { before, ...fields } = Object.fromEntries(new FormData(form));
  return { ...fields, before:inspectionView?.before ?? [] };
}
function inspectionPage(zone) {
  if (!inspectionView) {
    inspectionView = { ...(data.draft ?? { date:today, zone:"A", due:today, before:[] }) };
  }
  if (zone) inspectionView.zone = zone;
  const draft = inspectionView;
  const field = (key) => el(draft[key]);
  return heading("巡檢通報", "記錄現場狀況，整理草稿並確認缺失內容。") +
    `<form id="inspection-form" class="columns">
    ${panel("現場採集", `<div class="form-grid">
      <label class="field">巡檢日期<input name="date" type="date" value="${field("date")}" required></label>
      <label class="field">工區<select name="zone">${zoneOptions(draft.zone)}</select></label>
      <label class="field full">樁號或設施編號<input name="location" value="${field("location")}" placeholder="例如 K0+230 或 DR-07" required maxlength="100"></label>
      <div class="field full"><div class="field-head"><label for="speech-text">現場描述</label><button class="btn slim" type="button" data-speech>${icon("mic")}語音輸入</button></div>
        <textarea id="speech-text" name="raw" placeholder="例如開挖區靠便道側圍設有缺口，請重新固定圍設。" maxlength="4000">${field("raw")}</textarea>
        <small id="speech-status" aria-live="polite">可直接打字。語音辨識使用瀏覽器提供的服務。</small></div>
      <label class="field full">現場照片<input name="before" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>手機可選擇相機或照片。每次最多 5 張，每張最多 8 MB。</small></label>
      <div class="full" id="before-preview">${photos(draft.before)}</div></div>
      <div class="actions"><button type="button" class="btn" data-organize>${icon("inspect")}整理成草稿</button></div>`, "", "inspect")}
    ${panel("巡檢草稿", `<div class="form-grid">
      <p class="note full">草稿依現場描述套用固定欄位。請核對位置、缺失內容與改善期限再送出。</p>
      <label class="field full">缺失標題<input name="title" value="${field("title")}" required maxlength="100"></label>
      <label class="field full">缺失與改善要求<textarea name="notes" required maxlength="4000">${field("notes")}</textarea></label>
      <label class="field">改善負責人<input name="owner" value="${field("owner")}" required maxlength="80"></label>
      <label class="field">改善期限<input name="due" type="date" value="${field("due")}" required></label>
      <label class="full"><input type="checkbox" name="verified" value="yes" required> 我已核對紀錄並確認送交改善追蹤</label>
    </div><div class="actions"><button type="button" class="btn" data-save-draft>儲存草稿</button><button class="btn primary">確認並送出</button></div>`, "", "report")}
    </form>`;
}
function bindInspection() {
  const form = main.querySelector("#inspection-form");
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
  form.querySelector("[data-organize]").addEventListener("click", () => {
    const raw = form.elements.raw.value.trim();
    if (!raw) { form.elements.raw.focus(); notify("請先輸入現場描述。"); return; }
    if (!form.elements.title.value.trim()) {
      const firstLine = raw.split(/[。！？\r\n]/u).find((line) => line.trim()) ?? raw;
      form.elements.title.value = firstLine.trim().slice(0, 100);
    }
    if (!form.elements.notes.value.trim()) form.elements.notes.value = raw;
    inspectionView = currentDraft(form);
    form.elements.title.focus();
    notify("已整理草稿，請核對並補上改善負責人。");
  });
  form.querySelector("[data-save-draft]").addEventListener("click", () => commitForm(form, async () => {
    if (form.elements.before.files.length) throw new Error("照片讀取中，請稍候再儲存。");
    inspectionView = currentDraft(form);
    await save({ ...data, draft:inspectionView });
    notify("草稿已儲存在此瀏覽器。");
  }));
  form.querySelector("[data-speech]").addEventListener("click", () => startSpeech(form));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(form, async () => {
      if (form.elements.before.files.length) throw new Error("照片讀取中，請稍候再送出。");
      const draft = currentDraft(form);
      for (const key of ["title", "notes", "location", "owner"]) draft[key] = requireText(draft[key]);
      if (draft.due < draft.date) throw new Error("改善期限須在巡檢日期當天或之後。");
      const { verified, ...fields } = draft;
      const id = `巡-${String(data.nextId).padStart(4, "0")}`;
      await save({
        ...data, nextId:data.nextId + 1, draft:null,
        records:[...data.records, { ...fields, id, status:"open", after:[], reviews:[] }],
      });
      inspectionView = null;
      notify(`${id} 已送交改善追蹤。`);
      location.hash = "tracking";
    });
  });
}
function startSpeech(form) {
  const status = form.querySelector("#speech-status");
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { status.textContent = "這個瀏覽器目前未提供語音辨識，可直接輸入現場描述。"; return; }
  if (speech) { speech.stop(); return; }
  const session = new Recognition();
  speech = session;
  session.lang = "zh-TW";
  session.interimResults = false;
  session.onstart = () => { status.textContent = "正在聆聽，請說出現場狀況。"; };
  session.onerror = () => { status.textContent = "語音辨識未完成，請確認麥克風權限或改用文字輸入。"; };
  session.onresult = (event) => {
    if (!form.isConnected) return;
    const input = form.elements.raw;
    const words = [...event.results].slice(event.resultIndex).map((result) => result[0].transcript).join("");
    input.value = [input.value.trim(), words].filter(Boolean).join("\n").slice(0, 4000);
    inspectionView = currentDraft(form);
    status.textContent = "已加入語音辨識文字，請核對後整理草稿。";
  };
  session.onend = () => {
    if (speech === session) speech = null;
    if (status.textContent.startsWith("正在聆聽")) status.textContent = "語音辨識已結束。";
  };
  try { session.start(); } catch {
    speech = null;
    status.textContent = "無法啟動語音辨識，可直接輸入文字。";
  }
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
    return matches && [record.title, record.id, record.location, record.owner, zoneName(record.zone)]
      .some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  });
  return table(["缺失事項", "位置", "負責人", "改善期限", "狀態"], records.map((record) => [
    `${recordButton(record)}<small class="muted">${el(record.id)} · ${el(record.date)}</small>`,
    `${el(zoneName(record.zone))}<small class="muted">${el(record.location)}</small>`,
    el(record.owner), el(record.due), `${badge(record.status)}${issueStatus(record) === "late" ? ` ${badge("late")}` : ""}`,
  ]));
}
function openRecord(id) {
  const record = data.records.find((entry) => entry.id === id);
  if (!record) return;
  const closed = record.status === "closed";
  const canReview = record.status === "review";
  dialogContent.innerHTML = `<div class="section-head"><div><h2 id="dialog-title">${el(record.title)}</h2>
    <small class="muted">${el(id)} · ${record.date}</small></div><button class="btn slim" data-close>關閉</button></div>
    <div class="info"><p>${badge(record.status)} ${issueStatus(record) === "late" ? badge("late") : ""}</p>
    <p><strong>位置</strong> ${el(zoneName(record.zone))} · ${el(record.location)}</p><p class="preview-text">${el(record.notes)}</p></div>
    <h3>改善前照片</h3>${photos(record.before)}<h3>改善後照片</h3>${photos(record.after)}
    <h3>複查紀錄</h3>${record.reviews.length ? table(["日期", "複查人員", "結果", "紀錄"], record.reviews.map((review) => [
      el(review.date), el(review.reviewer), review.passed ? "通過並結案" : "退回改善", el(review.notes),
    ])) : '<p class="field-note">尚無複查紀錄</p>'}
    ${closed ? `<p class="note status">負責人 ${el(record.owner)} · 改善期限 ${el(record.due)}</p>` : `
    <h3>更新改善進度</h3><form id="update-record"><div class="form-grid">
      <label class="field">改善負責人<input name="owner" value="${el(record.owner)}" required maxlength="80"></label>
      <label class="field">改善期限<input name="due" type="date" min="${record.date}" value="${el(record.due)}" required></label>
      <label class="field">處理狀態<select name="status">${["open","progress","review"].map((key) =>
        `<option value="${key}"${record.status === key ? " selected" : ""}>${statusNames[key]}</option>`).join("")}</select></label>
      <label class="field">新增改善後照片<input type="file" name="after" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>每次最多 5 張，每張最多 8 MB。</small></label>
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
  update?.addEventListener("submit", (event) => {
    event.preventDefault();
    commitForm(update, async () => {
      const form = new FormData(update);
      await saveRecord({ ...record, owner:requireText(form.get("owner")), due:form.get("due"), status:form.get("status"),
        after:[...record.after, ...await imageList(update.elements.after.files)] });
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
  dialog.close();
  if (currentPage === "tracking") {
    main.querySelector("#tracking-results").innerHTML = trackingRows(main.querySelector("#query").value);
  } else {
    render();
  }
}

function reportPage() {
  return heading("報表匯出", "依日期篩選巡檢與缺失紀錄，匯出 CSV 或列印。") +
    `<section class="panel" id="report-panel">
    <div class="section-head report-actions"><div class="tabs" aria-label="報表種類">${[
      ["inspection","巡檢紀錄"], ["issues","缺失改善"], ["weekly","每週職安摘要"],
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
  const records = recentRecords().filter((record) => inRange(record.date));
  if (reportType === "inspection") return {
    title:"巡檢紀錄",
    headers:["編號", "巡檢日期", "工區", "樁號／設施", "缺失標題", "缺失與改善要求", "照片張數"],
    rows:records.map((record) => [record.id, record.date, zoneName(record.zone), record.location, record.title, record.notes, record.before.length]),
  };
  if (reportType === "issues") return {
    title:"缺失改善報表",
    headers:["編號", "巡檢日期", "工區", "樁號／設施", "缺失標題", "改善負責人", "改善期限", "處理狀態", "逾期", "改善前照片張數", "改善後照片張數", "複查紀錄"],
    rows:records.map((record) => [
      record.id, record.date, zoneName(record.zone), record.location, record.title, record.owner, record.due, statusNames[record.status],
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
  const { title, headers, rows } = reportRows();
  return `<div class="section-head"><h2>${title}</h2></div><p class="report-meta">${el(reportFrom)} 至 ${el(reportTo)}${reportType === "weekly" ? "" : ` · 共 ${rows.length} 筆`}</p>${table(headers, rows.map((row) => row.map((value) => `<span class="preview-text">${el(value)}</span>`))) }`;
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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title}_${reportFrom}_${reportTo}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bindReport() {
  const form = main.querySelector("#report-filters");
  form.addEventListener("input", () => {
    reportFrom = form.elements.from.value;
    reportTo = form.elements.to.value;
    form.elements.to.min = reportFrom;
    main.querySelector("#report-preview").innerHTML = reportPreview();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    downloadReport();
  });
  form.querySelector("[data-print]").addEventListener("click", () => {
    if (form.reportValidity()) window.print();
  });
}
function render(focus = false) {
  const [route, detail] = location.hash.slice(1).split("/");
  const target = pages.find(([key]) => key === route)?.[0] ?? "overview";
  if (currentPage === "inspection" && target !== currentPage && speech) speech.abort();
  currentPage = target;
  document.querySelector("#nav").innerHTML = pages.map(([key, label, symbol]) =>
    `<a href="#${key}"${key === target ? ' aria-current="page"' : ""}>${icon(symbol)}${label}</a>`).join("");
  switch (target) {
    case "map":
      if (zones.some((zone) => zone.id === detail)) selectedZone = detail;
      main.innerHTML = mapPage();
      break;
    case "inspection":
      main.innerHTML = inspectionPage(zones.some((zone) => zone.id === detail) ? detail : null);
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
  if (button.dataset.record) openRecord(button.dataset.record);
  if (button.dataset.zone) {
    selectedZone = button.dataset.zone;
    history.replaceState(null, "", `#map/${selectedZone}`);
    main.querySelectorAll("[data-zone]").forEach((entry) => entry.setAttribute("aria-pressed", entry === button));
    main.querySelector("#zone-details").innerHTML = zoneDetails();
  }
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

async function init() {
  try {
    db = await openDatabase();
    data = await storage("readonly", (store) => store.get("data"));
    if (!data) {
      try {
        await save(sampleData());
      } catch (error) {
        data = await storage("readonly", (store) => store.get("data"));
        if (!data) throw error;
      }
    }
    render();
  } catch {
    main.innerHTML = heading("無法開啟工作區", "請確認瀏覽器允許此網站儲存資料，重新載入後再試。");
  }
}
init();
