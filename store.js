// 儲存層:主資料存 localStorage(JSON),照片存 IndexedDB。
// 全部資料只在這支手機/瀏覽器裡,不經過任何伺服器。

const KEY = 'slim_db_v2';
const PHOTO_DB = 'slim_photos';
const PHOTO_KEEP_DAYS = 60; // 照片保留天數(數字記錄永久保留)

function defaults() {
  return {
    profile: null,
    targets: null,
    days: {},     // { 'YYYY-MM-DD': { meals: [], workoutDone: [] } }
    weeks: {},    // { weekStart: { mealPlan, workoutPlan } }
    weights: [],  // [{ date, kg }]
    chat: [],     // [{ role, content, at }]
    settings: { apiKey: '', model: 'claude-sonnet-5' },
  };
}

export const DB = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : {};
    const base = defaults();
    for (const k of Object.keys(base)) if (d[k] === undefined || d[k] === null) d[k] = base[k];
    d.settings = { ...base.settings, ...(d.settings || {}) };
    return d;
  } catch {
    return defaults();
  }
})();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(DB));
}

// ---- 日期工具 ----
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekStartOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateStr(d);
}

export function weekDates(weekStart) {
  const out = [];
  const d = new Date(weekStart + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    out.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function shiftWeek(weekStart, n) {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return localDateStr(d);
}

// ---- 當日 ----
export function getDay(dateStr) {
  let day = DB.days[dateStr];
  if (!day) { day = { meals: [], workoutDone: [] }; DB.days[dateStr] = day; }
  if (!Array.isArray(day.meals)) day.meals = [];
  if (!Array.isArray(day.workoutDone)) day.workoutDone = [];
  return day;
}

export function dayTotals(day) {
  return (day.meals || []).reduce(
    (acc, m) => {
      acc.calories += m.totalCalories || 0;
      acc.protein += m.protein || 0;
      acc.carb += m.carb || 0;
      acc.fat += m.fat || 0;
      return acc;
    },
    { calories: 0, protein: 0, carb: 0, fat: 0 }
  );
}

export function getWeek(weekStart) {
  let w = DB.weeks[weekStart];
  if (!w) { w = { mealPlan: null, workoutPlan: null }; DB.weeks[weekStart] = w; }
  return w;
}

export function lastDays(endDateStr, n) {
  const out = [];
  const end = new Date(endDateStr + 'T12:00:00');
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const ds = localDateStr(d);
    const day = DB.days[ds] || { meals: [], workoutDone: [] };
    const woDay = (DB.weeks[weekStartOf(ds)]?.workoutPlan?.days || []).find((x) => x.date === ds);
    out.push({
      date: ds,
      totals: dayTotals(day),
      mealCount: (day.meals || []).length,
      workoutDoneCount: (day.workoutDone || []).length,
      workoutTotal: woDay?.items?.length || 0,
      workoutType: woDay?.type || null,
    });
  }
  return out;
}

export function addChat(role, content) {
  DB.chat.push({ role, content, at: new Date().toISOString() });
  if (DB.chat.length > 200) DB.chat = DB.chat.slice(-200);
  save();
}

// ---- 照片(IndexedDB)----
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbOp(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode);
    const store = tx.objectStore('photos');
    const out = fn(store);
    tx.oncomplete = () => { db.close(); resolve(out.result !== undefined ? out.result : out); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function putPhoto(id, blob, date) {
  return idbOp('readwrite', (s) => s.put({ id, blob, date }));
}

export async function getPhoto(id) {
  const rec = await idbOp('readonly', (s) => s.get(id));
  return rec?.blob || null;
}

export async function delPhoto(id) {
  return idbOp('readwrite', (s) => s.delete(id));
}

async function allPhotos() {
  return (await idbOp('readonly', (s) => s.getAll())) || [];
}

// 開機時清掉太舊的照片(數字記錄保留,只清照片本體)
export async function prunePhotos() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PHOTO_KEEP_DAYS);
  const cutoffStr = localDateStr(cutoff);
  try {
    const photos = await allPhotos();
    for (const p of photos) {
      if ((p.date || '') < cutoffStr) await delPhoto(p.id);
    }
  } catch { /* 清理失敗不影響使用 */ }
}

// ---- 備份 / 還原 / 匯入舊資料 ----
function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function b64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportBackup() {
  const photos = [];
  try {
    for (const p of await allPhotos()) {
      photos.push({ id: p.id, date: p.date, b64: await blobToB64(p.blob) });
    }
  } catch { /* 照片匯出失敗仍可備份數字資料 */ }
  const payload = {
    kind: 'slimmaster-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    db: { ...DB, settings: { ...DB.settings, apiKey: '' } }, // API key 不進備份檔
    photos,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

// 支援三種檔案:本 App 的備份檔、電腦版(BiteSize/享瘦高手伺服器版)的 db.json
export async function restoreFromObject(obj) {
  if (obj?.kind === 'slimmaster-backup' && obj.db) {
    const keepKey = DB.settings.apiKey;
    Object.assign(DB, defaults(), obj.db);
    DB.settings = { ...DB.settings, apiKey: keepKey || DB.settings.apiKey };
    save();
    for (const p of obj.photos || []) {
      try { await putPhoto(p.id, b64ToBlob(p.b64), p.date); } catch { /* 單張失敗跳過 */ }
    }
    return `已還原備份(${obj.exportedAt?.slice(0, 10) || ''})`;
  }
  // 電腦版 db.json:有 profile/days/weights
  if (obj && typeof obj.days === 'object' && ('profile' in obj)) {
    if (obj.profile) { DB.profile = obj.profile; DB.targets = obj.targets || DB.targets; }
    if (Array.isArray(obj.weights)) {
      const map = new Map(DB.weights.map((w) => [w.date, w]));
      for (const w of obj.weights) if (w?.date && w?.kg) map.set(w.date, { date: w.date, kg: w.kg });
      DB.weights = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    }
    let mealCount = 0;
    for (const [date, day] of Object.entries(obj.days || {})) {
      if (!Array.isArray(day?.meals) || !day.meals.length) continue;
      const target = getDay(date);
      const existing = new Set(target.meals.map((m) => m.id));
      for (const m of day.meals) {
        if (existing.has(m.id)) continue;
        target.meals.push({
          id: m.id || `${Date.now()}-${Math.random()}`,
          mealType: m.mealType || 'other',
          loggedAt: m.loggedAt || `${date}T12:00:00.000Z`,
          photo: null, // 舊照片存在電腦上,不匯入
          description: m.description || '',
          name: m.name || '',
          items: m.items || [],
          totalCalories: m.totalCalories || 0,
          protein: m.protein || 0,
          carb: m.carb || 0,
          fat: m.fat || 0,
          advice: m.advice || m.note || '',
        });
        mealCount++;
      }
    }
    if (obj.weeks && typeof obj.weeks === 'object') {
      for (const [ws, w] of Object.entries(obj.weeks)) {
        const cur = getWeek(ws);
        if (w?.mealPlan && !cur.mealPlan) cur.mealPlan = w.mealPlan;
        if (w?.workoutPlan && !cur.workoutPlan) cur.workoutPlan = w.workoutPlan;
      }
    }
    save();
    return `已匯入電腦版資料:${mealCount} 筆餐點、${(obj.weights || []).length} 筆體重`;
  }
  throw new Error('無法辨識的檔案格式,請選擇本 App 的備份檔或電腦版的 db.json');
}

export function storageStats() {
  const meals = Object.values(DB.days).reduce((s, d) => s + (d.meals?.length || 0), 0);
  const kb = Math.round((localStorage.getItem(KEY) || '').length / 1024);
  return { meals, weights: DB.weights.length, chats: DB.chat.length, kb };
}
