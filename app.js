// 享瘦高手 — 純手機版 PWA(免伺服器)
// 資料只存在本機(localStorage + IndexedDB),AI 直連 Anthropic API。
import { calcTargets, targetsForDate, carbTypeForDate, CARB_DAY_TYPES, INTENSITIES } from './nutrition.js';
import {
  DB, save, localDateStr, weekStartOf, weekDates, shiftWeek,
  getDay, dayTotals, getWeek, lastDays, addChat,
  putPhoto, getPhoto, delPhoto, prunePhotos,
  exportBackup, restoreFromObject, storageStats,
} from './store.js';
import {
  hasKey, aiDayMeals, aiDayWorkout, aiAnalyzeMeal, aiChat, aiWeekReport, aiTestKey, weekdayOf,
} from './ai.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const app = $('#app');
const tabbar = $('#tabbar');

const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心', other: '其他' };
const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍱', dinner: '🍲', snack: '🍎', other: '🍽️' };
const TYPE_LABELS = { strength: '重訓', cardio: '有氧', mixed: '重訓+有氧', rest: '休息' };
const GOAL_LABELS = { lose: '減脂', recomp: '增肌減脂', gain: '增肌', maintain: '維持' };

// 當日有效目標(碳循環):有 cycle 時回當日碳日目標,否則回平均目標。
function effTargets(dateStr) {
  const d = targetsForDate(dateStr, DB.targets);
  return d || { type: null, label: '', calorieTarget: DB.targets?.calorieTarget || 0, macros: DB.targets?.macros || {} };
}
// 碳日小標籤 HTML(type 為 high/mid/low)。
function carbBadge(type) {
  if (!type || !CARB_DAY_TYPES[type]) return '';
  const d = CARB_DAY_TYPES[type];
  return `<span class="badge carb-${type}">${d.emoji} ${d.label}</span>`;
}
// 碳循環總覽:三種碳日目標 + 本週輪替。
function cycleOverviewHTML(targets) {
  const cyc = targets?.cycle;
  if (!cyc?.byType) return '';
  const typeRows = ['high', 'mid', 'low'].map((k) => {
    const d = cyc.byType[k];
    return `<div class="carb-row">
      ${carbBadge(k)}
      <span class="muted small" style="margin-left:auto">${d.calorieTarget} kcal・蛋白 ${d.macros.proteinG} / 碳 ${d.macros.carbG} / 脂 ${d.macros.fatG} g</span>
    </div>`;
  }).join('');
  const weekRow = cyc.pattern.map((k, i) => `
    <div class="carb-week-cell carb-${k}">
      <div class="wd">${cyc.weekdayLabels[i].replace('週', '')}</div>
      <div class="em">${CARB_DAY_TYPES[k].emoji}</div>
    </div>`).join('');
  const cnt = cyc.counts || {};
  return `
    <div class="card">
      <h2>碳循環設定 <span class="muted small">(${(INTENSITIES[cyc.intensity] || INTENSITIES.auto).label})</span></h2>
      ${typeRows}
      <div class="muted small" style="margin:10px 0 4px">本週輪替(高 ${cnt.high || 0}・中 ${cnt.mid || 0}・低 ${cnt.low || 0} 天)</div>
      <div class="carb-week">${weekRow}</div>
      <div class="muted small" style="margin-top:8px">高碳日=重訓日、中碳日=中強度/有氧、低碳日=休息或低強度有氧。要調整強度到「個人檔案」修改「碳循環強度」。</div>
    </div>`;
}

const S = {
  tab: 'today',
  date: localDateStr(),
  planView: 'meals',
  planWeekStart: weekStartOf(localDateStr()),
  genBusy: { meals: false, workout: false },
  genProgress: { meals: null, workout: null }, // { done, total } 分天產生進度
  logMealType: defaultMealType(),
  logPhoto: null,      // { b64, blob }
  logPhotoUrl: null,
  logDesc: '',
  logBusy: false,
  lastAnalysis: null,
  chatLocal: [],
  chatBusy: false,
  reportBusy: false,
  showProfileForm: false,
};

function defaultMealType() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}
function md(ds) { const [, m, d] = ds.split('-'); return `${Number(m)}/${Number(d)}`; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function newId() { return `${Date.now()}-${Math.round(Math.random() * 1e6)}`; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function openModal(title, html) {
  $('#modal-root').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close">✕</button></div>
        ${html}
      </div>
    </div>`;
  $('.modal-close').onclick = closeModal;
  $('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(); };
}
function closeModal() { $('#modal-root').innerHTML = ''; }

// 自製確認框:iOS 加到主畫面的全螢幕模式下,原生 confirm() 可能不跳出,一律用這個
function confirmDialog(msg, okLabel = '確定') {
  return new Promise((resolve) => {
    $('#modal-root').innerHTML = `
      <div class="modal-overlay">
        <div class="modal-sheet">
          <div style="font-size:15px;font-weight:600;padding:6px 2px 16px">${esc(msg)}</div>
          <div style="display:flex;gap:10px">
            <button class="btn subtle block" id="cfm-no">取消</button>
            <button class="btn block" id="cfm-ok">${esc(okLabel)}</button>
          </div>
        </div>
      </div>`;
    const done = (v) => { closeModal(); resolve(v); };
    $('#cfm-ok').onclick = () => done(true);
    $('#cfm-no').onclick = () => done(false);
    $('.modal-overlay').onclick = (e) => { if (e.target.classList.contains('modal-overlay')) done(false); };
  });
}

function updateBanner() {
  const b = $('#key-banner');
  b.hidden = hasKey();
}

// 換日時自動切到新的一天
function ensureToday() {
  const now = localDateStr();
  if (S.date !== now) {
    S.date = now;
    S.planWeekStart = weekStartOf(now);
    S.logMealType = defaultMealType();
  }
}

// 把 <img data-photo-id> 補上 IndexedDB 裡的照片
const photoUrlCache = new Map();
async function hydratePhotos(root = app) {
  for (const img of $$('[data-photo-id]', root)) {
    const id = img.dataset.photoId;
    if (photoUrlCache.has(id)) { img.src = photoUrlCache.get(id); continue; }
    const blob = await getPhoto(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      photoUrlCache.set(id, url);
      img.src = url;
    } else {
      img.outerHTML = `<div class="meal-emoji">🍽️</div>`;
    }
  }
}

// ================= 今日 =================
function ringHTML(eaten, target) {
  const R = 54, C = 2 * Math.PI * R;
  const pct = Math.min(1, target ? eaten / target : 0);
  const over = target && eaten > target;
  const remain = Math.max(0, (target || 0) - eaten);
  return `
    <div class="ring-wrap">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="${R}" fill="none" stroke="var(--border)" stroke-width="11"/>
        <circle cx="64" cy="64" r="${R}" fill="none" stroke="${over ? 'var(--accent)' : 'var(--primary)'}"
          stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
      </svg>
      <div class="ring-center">
        <span class="big">${over ? `+${eaten - target}` : remain}</span>
        <span class="muted small">${over ? '超出 kcal' : '還可吃 kcal'}</span>
      </div>
    </div>`;
}

function macroHTML(cls, label, val, target) {
  const pct = Math.min(100, target ? (val / target) * 100 : 0);
  return `
    <div class="macro ${cls}">
      <div class="lab"><span>${label}</span><span>${Math.round(val)} / ${target} g</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
}

function recipeModal(meal, label) {
  openModal(`${label}｜${meal.name}`, `
    <div class="card">
      <div class="totals-line">
        <span>🔥 ${meal.kcal} kcal</span><span>蛋白質 ${meal.protein}g</span>
        <span>碳水 ${meal.carb}g</span><span>脂肪 ${meal.fat}g</span>
      </div>
      ${meal.ingredients?.length ? `<h2 style="margin-top:12px">食材</h2><ul style="padding-left:20px;font-size:14px">${meal.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${meal.steps?.length ? `<h2 style="margin-top:12px">作法</h2><ol style="padding-left:20px;font-size:14px">${meal.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${meal.tip ? `<div class="callout">💡 ${esc(meal.tip)}</div>` : ''}
    </div>`);
}

function loggedRowHTML(m, { withAdvice = false } = {}) {
  return `
    <div class="meal-row">
      ${m.photo ? `<img class="log-photo" data-photo-id="${esc(m.id)}" alt=""/>` : `<div class="meal-emoji">${MEAL_EMOJI[m.mealType] || '🍽️'}</div>`}
      <div class="meal-info">
        <div class="name">${esc(m.name || MEAL_LABELS[m.mealType] || '一餐')}</div>
        <div class="kcal">${MEAL_LABELS[m.mealType] || ''}・${m.totalCalories} kcal・蛋白質 ${m.protein}g</div>
        ${withAdvice && m.advice ? `<div class="muted small" style="margin-top:2px">${esc(m.advice)}</div>` : ''}
      </div>
      <button class="btn sm danger" data-del="${esc(m.id)}">刪除</button>
    </div>`;
}

function bindDeleteButtons(rerender) {
  $$('[data-del]').forEach((el) => (el.onclick = async () => {
    if (!(await confirmDialog('刪除這筆記錄?', '刪除'))) return;
    const day = getDay(S.date);
    day.meals = day.meals.filter((m) => m.id !== el.dataset.del);
    save();
    delPhoto(el.dataset.del).catch(() => {});
    rerender();
  }));
}

function renderToday() {
  const t = effTargets(S.date);
  const day = getDay(S.date);
  const totals = dayTotals(day);
  const week = getWeek(weekStartOf(S.date));
  const mealDay = week.mealPlan?.days?.find((d) => d.date === S.date);
  const woDay = week.workoutPlan?.days?.find((d) => d.date === S.date);
  const doneSet = new Set(day.workoutDone || []);

  let mealsHTML;
  if (mealDay) {
    mealsHTML = ['breakfast', 'lunch', 'dinner'].map((k) => {
      const m = mealDay.meals?.[k];
      if (!m) return '';
      return `
        <div class="meal-row">
          <div class="meal-emoji">${MEAL_EMOJI[k]}</div>
          <div class="meal-info">
            <div class="name">${esc(m.name)}</div>
            <div class="kcal">${MEAL_LABELS[k]}・${m.kcal} kcal・蛋白質 ${m.protein}g</div>
          </div>
          <div class="meal-acts">
            <button class="btn sm ghost" data-recipe="${k}">食譜</button>
            <button class="btn sm" data-eat="${k}">吃了✓</button>
          </div>
        </div>`;
    }).join('');
  } else {
    mealsHTML = `
      <div class="empty"><span class="big-emoji">🥗</span>本週還沒有菜單<br/>
      <button class="btn" id="gen-meals-today" style="margin-top:12px" ${S.genBusy.meals ? 'disabled' : ''}>${S.genBusy.meals ? `<span class="spinner"></span> 規劃中 ${S.genProgress.meals ? `${S.genProgress.meals.done}/${S.genProgress.meals.total} 天` : ''}…請保持畫面開著` : '請教練排本週菜單'}</button></div>`;
  }

  let woHTML;
  if (woDay) {
    const items = woDay.items || [];
    woHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
        ${carbBadge(woDay.carbDay || carbTypeForDate(S.date, DB.targets?.cycle))}
        <span class="badge ${esc(woDay.type)}">${TYPE_LABELS[woDay.type] || esc(woDay.type)}</span>
        <b>${esc(woDay.focus || '')}</b>
        <span class="muted small" style="margin-left:auto">${esc(woDay.duration || '')}</span>
      </div>
      ${woDay.timing ? `<div class="callout green">⏰ ${esc(woDay.timing)}</div>` : ''}
      <div style="margin-top:6px">
        ${items.map((it, i) => `
          <div class="wo-item ${doneSet.has(i) ? 'done' : ''}">
            <div class="wo-head">
              <input type="checkbox" data-chk="${i}" ${doneSet.has(i) ? 'checked' : ''}/>
              <div class="t"><div class="n">${esc(it.name)}</div><div class="d">${esc(it.detail || '')}</div></div>
              <span class="arrow">▶</span>
            </div>
            <div class="wo-howto">${esc(it.howTo || '')}${it.muscles ? `<div class="muted small" style="margin-top:4px">🎯 ${esc(it.muscles)}</div>` : ''}</div>
          </div>`).join('')}
      </div>
      <div class="muted small" style="margin-top:6px">已完成 ${doneSet.size}/${items.length} 項</div>`;
  } else {
    woHTML = `
      <div class="empty"><span class="big-emoji">🏋️</span>本週還沒有運動計畫<br/>
      <button class="btn" id="gen-wo-today" style="margin-top:12px" ${S.genBusy.workout ? 'disabled' : ''}>${S.genBusy.workout ? `<span class="spinner"></span> 規劃中 ${S.genProgress.workout ? `${S.genProgress.workout.done}/${S.genProgress.workout.total} 天` : ''}…請保持畫面開著` : '請教練排本週訓練'}</button></div>`;
  }

  const logged = day.meals || [];
  app.innerHTML = `
    <div class="app-header">
      <div class="brand">💪 享瘦高手<small>你的隨身營養師 + 健身教練</small></div>
      <div class="date-chip">${md(S.date)} ${weekdayOf(S.date)}</div>
    </div>
    <div class="card">
      ${t.type ? `<div class="carb-head">${carbBadge(t.type)}<span class="muted small">${esc(CARB_DAY_TYPES[t.type].desc)}</span></div>` : ''}
      <div class="hero">
        ${ringHTML(totals.calories, t.calorieTarget)}
        <div class="macros">
          <div class="muted small" style="font-weight:700">已吃 ${totals.calories} / 目標 ${t.calorieTarget || '—'} kcal</div>
          ${macroHTML('p', '蛋白質', totals.protein, t.macros?.proteinG || 0)}
          ${macroHTML('c', '碳水', totals.carb, t.macros?.carbG || 0)}
          ${macroHTML('f', '脂肪', totals.fat, t.macros?.fatG || 0)}
        </div>
      </div>
    </div>

    <div class="section-title">今日菜單 ${mealDay ? '<button class="btn sm subtle" id="goto-plan-m">看整週</button>' : ''}</div>
    <div class="card">${mealsHTML}</div>

    <div class="section-title">今日運動 ${woDay ? '<button class="btn sm subtle" id="goto-plan-w">看整週</button>' : ''}</div>
    <div class="card">${woHTML}</div>

    <div class="section-title">今日已記錄</div>
    <div class="card">
      ${logged.length ? logged.map((m) => loggedRowHTML(m)).join('') : '<div class="muted small" style="padding:4px 2px">今天還沒記錄,到「記錄」分頁拍張照吧。</div>'}
    </div>`;

  $$('[data-recipe]').forEach((el) => (el.onclick = () => {
    const k = el.dataset.recipe;
    recipeModal(mealDay.meals[k], MEAL_LABELS[k]);
  }));
  $$('[data-eat]').forEach((el) => (el.onclick = () => {
    const k = el.dataset.eat;
    const m = mealDay.meals[k];
    getDay(S.date).meals.push({
      id: newId(), mealType: k, loggedAt: new Date().toISOString(), photo: null,
      description: '(照計畫吃)', name: m.name, items: [],
      totalCalories: Math.round(m.kcal) || 0, protein: Math.round(m.protein) || 0,
      carb: Math.round(m.carb) || 0, fat: Math.round(m.fat) || 0, advice: '',
    });
    save();
    toast(`已記錄:${m.name}`);
    renderToday();
    hydratePhotos();
  }));
  bindDeleteButtons(() => { renderToday(); hydratePhotos(); });
  $$('[data-chk]').forEach((el) => (el.onchange = () => {
    const day2 = getDay(S.date);
    const set = new Set(day2.workoutDone);
    if (el.checked) set.add(Number(el.dataset.chk)); else set.delete(Number(el.dataset.chk));
    day2.workoutDone = [...set].sort((a, b) => a - b);
    save();
    renderToday();
    hydratePhotos();
  }));
  $$('.wo-head').forEach((el) => (el.onclick = (e) => {
    if (e.target.tagName === 'INPUT') return;
    el.closest('.wo-item').classList.toggle('open');
  }));
  const gm = $('#gen-meals-today'); if (gm) gm.onclick = () => generatePlan('meals', weekStartOf(S.date));
  const gw = $('#gen-wo-today'); if (gw) gw.onclick = () => generatePlan('workout', weekStartOf(S.date));
  const gpm = $('#goto-plan-m'); if (gpm) gpm.onclick = () => { S.planView = 'meals'; switchTab('plan'); };
  const gpw = $('#goto-plan-w'); if (gpw) gpw.onclick = () => { S.planView = 'workout'; switchTab('plan'); };
  hydratePhotos();
}

// ================= 記錄 =================
async function downscalePhoto(file, max = 1024, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  const b64 = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return { blob, b64 };
}

function renderLog() {
  const day = getDay(S.date);
  const logged = day.meals || [];
  const a = S.lastAnalysis;
  app.innerHTML = `
    <div class="app-header">
      <div class="brand">📷 記錄一餐<small>拍照或打字,教練幫你分析</small></div>
    </div>
    <div class="chip-row" style="margin-bottom:12px">
      ${['breakfast', 'lunch', 'dinner', 'snack'].map((k) =>
        `<button class="chip ${S.logMealType === k ? 'active' : ''}" data-mt="${k}">${MEAL_EMOJI[k]} ${MEAL_LABELS[k]}</button>`).join('')}
    </div>
    <div class="photo-drop" id="photo-drop">
      ${S.logPhotoUrl
        ? `<img src="${S.logPhotoUrl}" alt="預覽"/><div class="muted small" style="margin-top:6px">點一下可重拍</div>`
        : `<div style="font-size:34px">📸</div><div style="font-weight:700;color:var(--text)">拍照或選擇照片</div><div class="small">也可以只用下面的文字描述</div>`}
    </div>
    <input type="file" id="photo-input" accept="image/*" hidden/>
    <div style="margin-top:12px">
      <textarea id="log-desc" rows="2" placeholder="補充描述(選填):例如「排骨便當,飯只吃一半」">${esc(S.logDesc || '')}</textarea>
    </div>
    <button class="btn block" id="analyze-btn" style="margin-top:12px" ${S.logBusy ? 'disabled' : ''}>
      ${S.logBusy ? '<span class="spinner"></span> 教練分析中…' : '請教練分析這一餐'}
    </button>

    ${a ? `
      <div class="card" style="margin-top:16px">
        <h2>🔍 ${esc(a.name)}</h2>
        <table class="items">
          ${(a.items || []).map((it) => `<tr><td>${esc(it.food)} <span class="muted small">${esc(it.portion || '')}</span></td><td>${it.calories} kcal</td></tr>`).join('')}
        </table>
        <div class="totals-line">
          <span>🔥 ${a.totalCalories} kcal</span><span>蛋白質 ${a.protein}g</span>
          <span>碳水 ${a.carb}g</span><span>脂肪 ${a.fat}g</span>
        </div>
        ${a.advice ? `<div class="callout green">🎯 ${esc(a.advice)}</div>` : ''}
      </div>` : ''}

    <div class="section-title">今天的記錄</div>
    <div class="card">
      ${logged.length ? logged.map((m) => loggedRowHTML(m, { withAdvice: true })).join('') : '<div class="muted small">還沒有記錄。</div>'}
    </div>`;

  $$('[data-mt]').forEach((el) => (el.onclick = () => { S.logMealType = el.dataset.mt; renderLog(); }));
  const input = $('#photo-input');
  $('#photo-drop').onclick = () => input.click();
  input.onchange = async () => {
    if (!input.files[0]) return;
    try {
      S.logPhoto = await downscalePhoto(input.files[0]);
      if (S.logPhotoUrl) URL.revokeObjectURL(S.logPhotoUrl);
      S.logPhotoUrl = URL.createObjectURL(S.logPhoto.blob);
      renderLog();
    } catch { toast('讀取照片失敗,請再試一次'); }
  };
  const descEl = $('#log-desc');
  descEl.oninput = () => (S.logDesc = descEl.value);
  $('#analyze-btn').onclick = async () => {
    const desc = descEl.value.trim();
    if (!S.logPhoto && !desc) return toast('請先拍照或輸入文字描述');
    S.logBusy = true; renderLog();
    try {
      const day2 = getDay(S.date);
      const eatenToday = day2.meals.map((m) => `${MEAL_LABELS[m.mealType] || ''}${m.name}(${m.totalCalories} kcal)`).join('、');
      const est = await aiAnalyzeMeal({
        description: desc,
        imageB64: S.logPhoto?.b64 || null,
        mealType: S.logMealType,
        eatenToday,
        date: S.date,
      });
      const meal = {
        id: newId(),
        mealType: S.logMealType,
        loggedAt: new Date().toISOString(),
        photo: !!S.logPhoto,
        description: desc,
        name: est.name || '',
        items: Array.isArray(est.items) ? est.items : [],
        totalCalories: Math.round(est.totalCalories) || 0,
        protein: Math.round(est.protein) || 0,
        carb: Math.round(est.carb) || 0,
        fat: Math.round(est.fat) || 0,
        advice: est.advice || '',
      };
      day2.meals.push(meal);
      save();
      if (S.logPhoto) await putPhoto(meal.id, S.logPhoto.blob, S.date).catch(() => {});
      S.lastAnalysis = { ...meal };
      S.logPhoto = null;
      if (S.logPhotoUrl) { URL.revokeObjectURL(S.logPhotoUrl); S.logPhotoUrl = null; }
      S.logDesc = '';
      toast('已記錄!');
    } catch (e) { toast(e.message); }
    S.logBusy = false;
    renderLog();
  };
  bindDeleteButtons(() => renderLog());
  hydratePhotos();
}

// ================= 計畫 =================
// 分天產生:每天一個小請求(快、手機上穩),逐天存檔;中途中斷會保留已完成的天數,
// 再按一次會從還沒排的那天接續。fresh=true 時先清空、整週重排。
async function generatePlan(kind, weekStart, note = '', fresh = false) {
  if (S.genBusy[kind]) return toast('教練正在規劃中,請稍候…');
  if (!hasKey()) { toast('請先到「我的」設定 API key'); switchTab('me'); return; }

  const dates = weekDates(weekStart);
  const week = getWeek(weekStart);
  const key = kind === 'meals' ? 'mealPlan' : 'workoutPlan';
  if (fresh || !week[key] || !Array.isArray(week[key].days)) {
    week[key] = kind === 'meals' ? { summary: '', days: [] } : { summary: '', scheduleNote: '', days: [] };
  }
  const plan = week[key];

  S.genBusy[kind] = true;
  S.genProgress[kind] = { done: plan.days.length, total: dates.length };
  render();

  const recent = kind === 'meals'
    ? lastDays(S.date, 7).flatMap((d) => (DB.days[d.date]?.meals || []).map((m) => m.name).filter(Boolean)).slice(-15).join('、')
    : '';

  try {
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      if (plan.days.some((d) => d.date === date)) continue; // 已排過 → 跳過(接續)
      let day;
      const dayTarget = targetsForDate(date, DB.targets);
      if (kind === 'meals') {
        const usedNames = plan.days.flatMap((d) => Object.values(d.meals || {}).map((m) => m?.name).filter(Boolean)).join('、');
        day = await aiDayMeals({ date, note, recentMeals: recent, usedNames, dayTarget });
        if (!day?.meals) throw new Error(`${md(date)} 回傳格式不完整`);
      } else {
        const weekSoFar = plan.days.map((d) => `${weekdayOf(d.date)}:${TYPE_LABELS[d.type] || d.type}`).join('、');
        day = await aiDayWorkout({ date, note, weekSoFar, dayIndex: i, total: dates.length, dayTarget });
        if (!day?.date) day = { ...day, date };
      }
      if (dayTarget?.type) day.carbDay = dayTarget.type;
      day.date = date;
      plan.days = plan.days.filter((d) => d.date !== date).concat([day]).sort((a, b) => a.date.localeCompare(b.date));
      S.genProgress[kind] = { done: plan.days.length, total: dates.length };
      save();
      render();
    }
    // 完成:補一句 summary
    if (kind === 'meals') {
      const avg = Math.round(plan.days.reduce((s, d) => s + ['breakfast', 'lunch', 'dinner'].reduce((x, k) => x + (d.meals?.[k]?.kcal || 0), 0), 0) / (plan.days.length || 1));
      plan.summary = `本週 ${plan.days.length} 天菜單,平均每日約 ${avg} kcal`;
    } else {
      const cnt = plan.days.reduce((a, d) => { a[d.type] = (a[d.type] || 0) + 1; return a; }, {});
      plan.summary = `本週訓練:重訓 ${cnt.strength || 0} 天・有氧 ${cnt.cardio || 0} 天・休息 ${cnt.rest || 0} 天`;
    }
    save();
    toast(kind === 'meals' ? '本週菜單完成!' : '本週運動計畫完成!');
  } catch (e) {
    toast(`${e.message}。已完成 ${plan.days.length}/${dates.length} 天,再按一次可接續。`);
  } finally {
    S.genBusy[kind] = false;
    S.genProgress[kind] = null;
    render();
  }
}

function renderPlan() {
  const ws = S.planWeekStart;
  const isThisWeek = ws === weekStartOf(S.date);
  const endD = new Date(ws + 'T12:00:00'); endD.setDate(endD.getDate() + 6);
  const endStr = `${endD.getMonth() + 1}/${endD.getDate()}`;
  const w = getWeek(ws);
  const view = S.planView;
  const gk = view === 'meals' ? 'meals' : 'workout';
  const busy = S.genBusy[gk];
  const prog = S.genProgress[gk];
  const plan = view === 'meals' ? w.mealPlan : w.workoutPlan;
  const dayCount = plan?.days?.length || 0;
  const complete = dayCount >= 7;

  let bodyHTML = '';
  if (view === 'meals') {
    bodyHTML = plan ? `
      ${plan.summary ? `<div class="callout green" style="margin-bottom:12px">📋 ${esc(plan.summary)}</div>` : ''}
      ${(plan.days || []).map((d) => `
        <div class="card day-card ${d.date === S.date ? 'today-card' : ''}">
          <div class="day-head"><span class="d">${md(d.date)} ${weekdayOf(d.date)}${d.date === S.date ? '(今天)' : ''} ${carbBadge(d.carbDay || carbTypeForDate(d.date, DB.targets?.cycle))}</span>
            <span class="muted small">${['breakfast','lunch','dinner'].reduce((s, k) => s + (d.meals?.[k]?.kcal || 0), 0)} kcal</span></div>
          ${['breakfast', 'lunch', 'dinner'].map((k) => {
            const m = d.meals?.[k];
            return m ? `<div class="plan-meal" data-r="${d.date}|${k}"><span class="ml">${MEAL_LABELS[k]}</span><span class="mn">${esc(m.name)}</span><span class="mk">${m.kcal} kcal ›</span></div>` : '';
          }).join('')}
        </div>`).join('')}`
      : `<div class="card"><div class="empty"><span class="big-emoji">🥗</span>這週還沒有菜單</div></div>`;
  } else {
    bodyHTML = plan ? `
      ${plan.summary ? `<div class="callout green" style="margin-bottom:12px">🏋️ ${esc(plan.summary)}</div>` : ''}
      ${plan.scheduleNote ? `<div class="callout" style="margin-bottom:12px">⏰ ${esc(plan.scheduleNote)}</div>` : ''}
      ${(plan.days || []).map((d) => `
        <div class="card day-card ${d.date === S.date ? 'today-card' : ''}">
          <div class="day-head">
            <span class="d">${md(d.date)} ${weekdayOf(d.date)}${d.date === S.date ? '(今天)' : ''} ${carbBadge(d.carbDay || carbTypeForDate(d.date, DB.targets?.cycle))}</span>
            <span class="badge ${esc(d.type)}">${TYPE_LABELS[d.type] || esc(d.type)}</span>
          </div>
          <div style="font-weight:700;font-size:14px">${esc(d.focus || '')} <span class="muted small">${esc(d.duration || '')}</span></div>
          ${d.timing ? `<div class="muted small" style="margin:4px 0 6px">⏰ ${esc(d.timing)}</div>` : ''}
          ${(d.items || []).map((it) => `
            <div class="wo-item">
              <div class="wo-head">
                <div class="t"><div class="n">${esc(it.name)}</div><div class="d">${esc(it.detail || '')}</div></div>
                <span class="arrow">▶</span>
              </div>
              <div class="wo-howto">${esc(it.howTo || '')}${it.muscles ? `<div class="muted small" style="margin-top:4px">🎯 ${esc(it.muscles)}</div>` : ''}</div>
            </div>`).join('')}
        </div>`).join('')}`
      : `<div class="card"><div class="empty"><span class="big-emoji">🏋️</span>這週還沒有運動計畫</div></div>`;
  }

  app.innerHTML = `
    <div class="app-header">
      <div class="brand">📅 每週計畫<small>菜單與訓練,一次排好一週</small></div>
    </div>
    <div class="week-nav">
      <button class="btn sm subtle" id="wk-prev">‹ 上週</button>
      <span class="title">${md(ws)} – ${endStr}${isThisWeek ? '(本週)' : ''}</span>
      <button class="btn sm subtle" id="wk-next">下週 ›</button>
    </div>
    <div class="seg">
      <button class="${view === 'meals' ? 'active' : ''}" data-v="meals">🥗 菜單</button>
      <button class="${view === 'workout' ? 'active' : ''}" data-v="workout">🏋️ 運動</button>
    </div>
    <div class="card">
      <input id="gen-note" placeholder="特別需求(選填):如「週三晚上聚餐」「肩膀不舒服」"/>
      <button class="btn block" id="gen-btn" style="margin-top:10px" ${busy ? 'disabled' : ''}>
        ${busy
          ? `<span class="spinner"></span> 教練規劃中 ${prog ? `${prog.done}/${prog.total} 天` : ''}…請保持畫面開著`
          : (!plan || dayCount === 0)
            ? `產生${view === 'meals' ? '本週菜單' : '本週運動計畫'}`
            : !complete
              ? `繼續產生(還差 ${7 - dayCount} 天)`
              : `重新產生${view === 'meals' ? '本週菜單' : '本週運動計畫'}`}
      </button>
    </div>
    ${bodyHTML}`;

  $('#wk-prev').onclick = () => { S.planWeekStart = shiftWeek(ws, -1); renderPlan(); };
  $('#wk-next').onclick = () => { S.planWeekStart = shiftWeek(ws, 1); renderPlan(); };
  $$('[data-v]').forEach((el) => (el.onclick = () => { S.planView = el.dataset.v; renderPlan(); }));
  $('#gen-btn').onclick = async () => {
    const note = $('#gen-note').value.trim();
    // 已排滿 7 天才需確認覆蓋;未排滿則直接接續產生
    if (complete && !(await confirmDialog('本週已排滿,要全部重新產生並覆蓋嗎?', '重新產生'))) return;
    generatePlan(gk, ws, note, complete /* fresh:滿週重排,未滿則接續 */);
  };
  $$('[data-r]').forEach((el) => (el.onclick = () => {
    const [date, k] = el.dataset.r.split('|');
    const m = w.mealPlan.days.find((d) => d.date === date)?.meals?.[k];
    if (m) recipeModal(m, `${md(date)} ${MEAL_LABELS[k]}`);
  }));
  $$('.wo-head').forEach((el) => (el.onclick = () => el.closest('.wo-item').classList.toggle('open')));
}

// ================= 教練 =================
const QUICK_PROMPTS = ['今天要練什麼?', '幫我把今天晚餐換清淡一點', '依我最近的記錄,有什麼要調整的?'];

function chatContext() {
  const week = getWeek(weekStartOf(S.date));
  const mealDay = week.mealPlan?.days?.find((d) => d.date === S.date);
  const woDay = week.workoutPlan?.days?.find((d) => d.date === S.date);
  const day = getDay(S.date);
  const totals = dayTotals(day);
  const t = effTargets(S.date);

  const lines = [];
  if (t.type) lines.push(`【今天是${t.label}】目標約 ${t.calorieTarget} kcal(蛋白質 ${t.macros?.proteinG} / 碳水 ${t.macros?.carbG} / 脂肪 ${t.macros?.fatG} g)`);
  lines.push('【今日計畫】');
  if (mealDay) {
    for (const [k, label] of Object.entries({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐' })) {
      const m = mealDay.meals?.[k];
      if (m) lines.push(`- ${label}:${m.name}(${m.kcal} kcal,蛋白質 ${m.protein} g)`);
    }
  } else lines.push('- 本週還沒有菜單計畫');
  if (woDay) {
    lines.push(`- 運動:${woDay.focus}(${woDay.duration || ''})— ${(woDay.items || []).map((i) => i.name).join('、')}`);
    if (woDay.timing) lines.push(`  時間建議:${woDay.timing}`);
    lines.push(`  已完成 ${day.workoutDone.length}/${(woDay.items || []).length} 項`);
  } else lines.push('- 本週還沒有運動計畫');

  lines.push('', '【今日已記錄】');
  lines.push(`累計 ${totals.calories} kcal / 目標 ${t.calorieTarget} kcal,蛋白質 ${totals.protein} g`);
  for (const m of day.meals) lines.push(`- ${MEAL_LABELS[m.mealType] || ''}:${m.name}(${m.totalCalories} kcal)`);

  // 近 7 日概況:讓教練依據歷史記錄給建議
  lines.push('', '【近 7 日概況】');
  for (const d of lastDays(S.date, 7)) {
    lines.push(`- ${d.date}(${weekdayOf(d.date)}):${d.totals.calories} kcal / 蛋白質 ${d.totals.protein} g / 記錄 ${d.mealCount} 餐 / 運動 ${d.workoutDoneCount}/${d.workoutTotal}`);
  }
  const weights = DB.weights.slice(-7);
  if (weights.length) lines.push('體重:' + weights.map((w2) => `${md(w2.date)} ${w2.kg}kg`).join('、'));
  return lines.join('\n');
}

function renderCoach() {
  const msgs = S.chatLocal;
  app.innerHTML = `
    <div class="app-header">
      <div class="brand">💬 教練聊天室<small>飲食、運動、調整計畫,直接問</small></div>
    </div>
    <div class="chat-box" id="chat-box">
      ${msgs.length ? '' : `
        <div class="bubble coach">嗨!我是享瘦高手,你的營養師兼健身教練 💪\n可以問我今天的運動內容、請我調整食譜,或任何飲食運動問題。</div>
        <div class="chip-row" style="justify-content:center">${QUICK_PROMPTS.map((q, i) => `<button class="chip" data-q="${i}">${q}</button>`).join('')}</div>`}
      ${msgs.map((c) => `<div class="bubble ${c.role === 'user' ? 'user' : c.role === 'sys' ? 'sys' : 'coach'}">${esc(c.content)}</div>`).join('')}
      ${S.chatBusy ? '<div class="bubble coach"><span class="typing"><i></i><i></i><i></i></span></div>' : ''}
    </div>
    <div class="chat-input">
      <input id="chat-msg" placeholder="輸入訊息…" autocomplete="off"/>
      <button class="btn" id="chat-send" ${S.chatBusy ? 'disabled' : ''}>送出</button>
    </div>`;

  window.scrollTo(0, document.body.scrollHeight);

  const input = $('#chat-msg');
  const send = async (text) => {
    const msg = (text || input.value).trim();
    if (!msg || S.chatBusy) return;
    if (!hasKey()) { toast('請先到「我的」設定 API key'); switchTab('me'); return; }
    input.value = '';
    const history = DB.chat.slice(-10).map((c) => `${c.role === 'user' ? '學員' : '享瘦高手'}:${c.content}`).join('\n');
    addChat('user', msg);
    S.chatLocal.push({ role: 'user', content: msg });
    S.chatBusy = true;
    renderCoach();
    try {
      const out = await aiChat({ date: S.date, context: chatContext(), history, message: msg });
      const reply = out.reply || String(out);
      const applied = [];
      for (const u of Array.isArray(out.mealUpdates) ? out.mealUpdates : []) {
        if (!u?.date || !u?.mealType || !u?.meal) continue;
        const dayPlan = getWeek(weekStartOf(u.date)).mealPlan?.days?.find((d) => d.date === u.date);
        if (dayPlan && ['breakfast', 'lunch', 'dinner'].includes(u.mealType)) {
          dayPlan.meals[u.mealType] = u.meal;
          applied.push(`已更新 ${u.date} ${MEAL_LABELS[u.mealType]}:${u.meal.name}`);
        }
      }
      for (const u of Array.isArray(out.workoutUpdates) ? out.workoutUpdates : []) {
        if (!u?.date || !u?.day) continue;
        const wp = getWeek(weekStartOf(u.date)).workoutPlan;
        const idx = wp?.days?.findIndex((d) => d.date === u.date);
        if (wp && idx !== undefined && idx !== -1) {
          wp.days[idx] = { ...u.day, date: u.date };
          getDay(u.date).workoutDone = [];
          applied.push(`已更新 ${u.date} 運動:${u.day.focus}`);
        }
      }
      addChat('assistant', reply);
      S.chatBusy = false;
      S.chatLocal.push({ role: 'assistant', content: reply });
      for (const a2 of applied) S.chatLocal.push({ role: 'sys', content: `✅ ${a2}` });
      save();
    } catch (e) {
      S.chatBusy = false;
      S.chatLocal.push({ role: 'sys', content: `⚠️ ${e.message}` });
    }
    renderCoach();
  };
  $('#chat-send').onclick = () => send();
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  $$('[data-q]').forEach((el) => (el.onclick = () => send(QUICK_PROMPTS[Number(el.dataset.q)])));
}

// ================= 我的 =================
function lineChartSVG(points, { w = 320, h = 120 } = {}) {
  if (points.length < 2) return `<div class="muted small">至少要 2 筆記錄才能畫趨勢圖。</div>`;
  const vals = points.map((p) => p.kg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = 14, span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}">
      <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
      ${points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="3" fill="var(--primary)"/>`).join('')}
      <text x="${pad}" y="12" font-size="10" fill="var(--muted)">${max} kg</text>
      <text x="${pad}" y="${h - 4}" font-size="10" fill="var(--muted)">${min} kg</text>
    </svg>
    <div class="muted small" style="display:flex;justify-content:space-between"><span>${md(points[0].date)}</span><span>${md(points.at(-1).date)}</span></div>`;
}

function kcalBarsSVG(days, target, { w = 320, h = 110 } = {}) {
  const pad = 6, bw = (w - pad * 2) / days.length;
  const maxV = Math.max(target || 0, ...days.map((d) => d.totals.calories), 1) * 1.1;
  const y = (v) => h - 16 - (v / maxV) * (h - 26);
  return `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}">
      ${target ? `<line x1="${pad}" x2="${w - pad}" y1="${y(target)}" y2="${y(target)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''}
      ${days.map((d, i) => {
        const v = d.totals.calories;
        const bx = pad + i * bw + bw * 0.18;
        return `<rect x="${bx.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(h - 16 - y(v)).toFixed(1)}" rx="3" fill="${v > target && target ? 'var(--accent)' : 'var(--primary)'}" opacity="${v ? 1 : 0.25}"/>
          <text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 3}" font-size="9" text-anchor="middle" fill="var(--muted)">${weekdayOf(d.date).replace('週', '')}</text>`;
      }).join('')}
    </svg>
    <div class="muted small">虛線為每日目標 ${target || '—'} kcal</div>`;
}

function profileFormHTML(p = {}) {
  const opt = (v, label, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${label}</option>`;
  return `
    <form id="profile-form">
      <div class="grid2">
        <label class="field"><span>性別</span>
          <select name="gender">${opt('female', '女', p.gender)}${opt('male', '男', p.gender)}</select></label>
        <label class="field"><span>年齡</span><input name="age" type="number" inputmode="numeric" required value="${p.age || ''}"/></label>
        <label class="field"><span>身高(cm)</span><input name="heightCm" type="number" inputmode="decimal" required value="${p.heightCm || ''}"/></label>
        <label class="field"><span>體重(kg)</span><input name="weightKg" type="number" step="0.1" inputmode="decimal" required value="${p.weightKg || ''}"/></label>
        <label class="field"><span>目標體重(kg,選填)</span><input name="targetWeightKg" type="number" step="0.1" inputmode="decimal" value="${p.targetWeightKg || ''}"/></label>
        <label class="field"><span>目標</span>
          <select name="goal">${opt('lose', '減脂', p.goal)}${opt('recomp', '增肌減脂(重組)', p.goal)}${opt('gain', '增肌', p.goal)}${opt('maintain', '維持', p.goal)}</select></label>
        <label class="field"><span>平常活動量</span>
          <select name="activity">${opt('sedentary', '久坐(很少運動)', p.activity)}${opt('light', '輕度(週 1-3 次)', p.activity || 'light')}${opt('moderate', '中度(週 3-5 次)', p.activity)}${opt('active', '高度(週 6-7 次)', p.activity)}</select></label>
        <label class="field"><span>速度</span>
          <select name="rate">${opt('slow', '和緩(週 0.25kg)', p.rate)}${opt('moderate', '標準(週 0.5kg)', p.rate || 'moderate')}${opt('fast', '積極(週 0.75kg)', p.rate)}</select></label>
        <label class="field"><span>碳循環強度</span>
          <select name="intensity">${opt('auto', '依目標(標準)', p.intensity || 'aggressive')}${opt('aggressive', '偏激進(多低碳日)', p.intensity || 'aggressive')}${opt('gentle', '溫和(均衡循環)', p.intensity)}</select></label>
      </div>
      <div class="muted small" style="margin:-4px 2px 8px">碳循環:高碳日(訓練日)吃較多碳水並排重訓,低碳日減碳並休息或低強度有氧,週間輪替以加速減脂。</div>
      <label class="field"><span>飲食限制/過敏(選填)</span><input name="restrictions" value="${esc(p.restrictions || '')}" placeholder="例:不吃牛、乳糖不耐"/></label>
      <label class="field"><span>口味偏好(選填)</span><input name="preferences" value="${esc(p.preferences || '')}" placeholder="例:愛吃辣、常吃超商"/></label>
      <label class="field"><span>可用運動器材(選填)</span><input name="equipment" value="${esc(p.equipment || '')}" placeholder="例:啞鈴一組、健身房會員、只能徒手"/></label>
      <label class="field"><span>作息備註(選填)</span><input name="scheduleNote" value="${esc(p.scheduleNote || '')}" placeholder="例:平日只有晚上 7 點後有空運動"/></label>
      <button class="btn block" type="submit">儲存</button>
    </form>`;
}

function bindProfileForm(afterSave) {
  $('#profile-form').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = Object.fromEntries(fd.entries());
    const profile = {
      gender: p.gender, age: Number(p.age), heightCm: Number(p.heightCm), weightKg: Number(p.weightKg),
      targetWeightKg: p.targetWeightKg ? Number(p.targetWeightKg) : null,
      activity: p.activity, goal: p.goal, rate: p.rate, intensity: p.intensity || 'aggressive',
      restrictions: p.restrictions || '', preferences: p.preferences || '',
      equipment: p.equipment || '', scheduleNote: p.scheduleNote || '',
    };
    if (!profile.age || !profile.heightCm || !profile.weightKg) return toast('請完整填寫年齡、身高、體重');
    DB.profile = profile;
    DB.targets = calcTargets(profile);
    save();
    toast('已儲存!目標已重新計算');
    afterSave();
  };
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function renderMe() {
  const p = DB.profile || {};
  const t = DB.targets || {};
  const weights = DB.weights || [];
  const stats = storageStats();
  app.innerHTML = `
    <div class="app-header">
      <div class="brand">👤 我的<small>目標、進度與設定</small></div>
    </div>
    <div class="card">
      <h2>每日目標 <span class="muted small">(碳循環週均)</span></h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${t.calorieTarget || '—'}</div><div class="l">週均熱量 kcal</div></div>
        <div class="stat"><div class="v">${t.macros?.proteinG || '—'} g</div><div class="l">蛋白質目標</div></div>
        <div class="stat"><div class="v">${t.tdee || '—'}</div><div class="l">TDEE kcal</div></div>
        <div class="stat"><div class="v">${t.bmr || '—'}</div><div class="l">BMR kcal</div></div>
      </div>
      <div class="muted small" style="margin-top:8px">目標:${GOAL_LABELS[p.goal] || '—'}${p.targetWeightKg ? `・目標體重 ${p.targetWeightKg} kg` : ''}</div>
    </div>

    ${cycleOverviewHTML(t)}

    <div class="card">
      <h2>體重記錄</h2>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="wt-input" type="number" step="0.1" inputmode="decimal" placeholder="今天體重(kg)"/>
        <button class="btn" id="wt-save">記錄</button>
      </div>
      ${lineChartSVG(weights.slice(-30))}
    </div>

    <div class="card">
      <h2>近 7 日熱量</h2>
      ${kcalBarsSVG(lastDays(S.date, 7), t.calorieTarget)}
      <button class="btn ghost block" id="report-btn" style="margin-top:12px" ${S.reportBusy ? 'disabled' : ''}>
        ${S.reportBusy ? '<span class="spinner dark"></span> 教練撰寫中…' : '📝 產生本週教練週報'}
      </button>
    </div>

    <div class="card">
      <h2>AI 設定</h2>
      <label class="field"><span>Anthropic API key(只存在這支手機)</span>
        <input id="api-key" type="password" placeholder="sk-ant-..." value="${esc(DB.settings.apiKey || '')}" autocomplete="off"/></label>
      <label class="field"><span>模型</span>
        <select id="api-model">
          <option value="claude-sonnet-5" ${DB.settings.model === 'claude-sonnet-5' ? 'selected' : ''}>Sonnet(推薦,分析較準)</option>
          <option value="claude-haiku-4-5-20251001" ${DB.settings.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Haiku(較省錢)</option>
        </select></label>
      <div style="display:flex;gap:8px">
        <button class="btn block" id="key-save">儲存</button>
        <button class="btn ghost block" id="key-test">測試連線</button>
      </div>
      <div class="muted small" style="margin-top:8px">到 console.anthropic.com → API Keys 申請。key 只存在本機,直連 Anthropic,不經過任何第三方伺服器。</div>
    </div>

    <div class="card">
      <h2>資料(只在這支手機)</h2>
      <div class="muted small" style="margin-bottom:10px">${stats.meals} 筆餐點・${stats.weights} 筆體重・${stats.chats} 則對話・約 ${stats.kb} KB${'　'}照片保留 60 天</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" id="backup-btn">⬇️ 備份到檔案</button>
        <button class="btn ghost" id="restore-btn">⬆️ 還原 / 匯入電腦版資料</button>
      </div>
      <input type="file" id="restore-input" accept="application/json,.json" hidden/>
      <div class="muted small" style="margin-top:8px">建議每隔一陣子備份一次,把檔案存到 iCloud 雲碟。換手機或清除瀏覽器資料前務必先備份。</div>
    </div>

    <div class="card">
      <h2 style="display:flex;justify-content:space-between;align-items:center">個人檔案
        <button class="btn sm subtle" id="toggle-profile">${S.showProfileForm ? '收合' : '編輯'}</button></h2>
      ${S.showProfileForm ? profileFormHTML(p) : `
        <div class="muted" style="font-size:14px">
          ${p.gender === 'male' ? '男' : '女'}・${p.age} 歲・${p.heightCm} cm・${p.weightKg} kg
          ${p.restrictions ? `<br/>限制:${esc(p.restrictions)}` : ''}
          ${p.preferences ? `<br/>偏好:${esc(p.preferences)}` : ''}
          ${p.equipment ? `<br/>器材:${esc(p.equipment)}` : ''}
        </div>`}
    </div>

    <div class="muted small" style="text-align:center;padding:6px 0 14px">
      享瘦高手 純手機版・資料只存在本機<br/>
      熱量與營養皆為 AI 估算,僅供日常參考,非醫療建議。
    </div>`;

  $('#toggle-profile').onclick = () => { S.showProfileForm = !S.showProfileForm; renderMe(); };
  if (S.showProfileForm) bindProfileForm(() => { S.showProfileForm = false; renderMe(); });
  $('#wt-save').onclick = () => {
    const kg = Number($('#wt-input').value);
    if (!kg) return toast('請輸入體重');
    const existing = DB.weights.find((w2) => w2.date === S.date);
    if (existing) existing.kg = kg;
    else DB.weights.push({ date: S.date, kg });
    DB.weights.sort((a, b) => a.date.localeCompare(b.date));
    save();
    toast('已記錄體重');
    renderMe();
  };
  $('#report-btn').onclick = async () => {
    if (!hasKey()) return toast('請先設定 API key');
    S.reportBusy = true; renderMe();
    try {
      const report = await aiWeekReport({ days: lastDays(S.date, 7), weights: DB.weights.slice(-7) });
      openModal('本週教練週報', `<div class="card" style="white-space:pre-wrap;font-size:14.5px">${esc(report)}</div>`);
    } catch (e) { toast(e.message); }
    S.reportBusy = false; renderMe();
  };
  $('#key-save').onclick = () => {
    DB.settings.apiKey = $('#api-key').value.trim();
    DB.settings.model = $('#api-model').value;
    save();
    updateBanner();
    toast(DB.settings.apiKey ? '已儲存 API 設定' : '已清除 API key');
  };
  $('#key-test').onclick = async () => {
    DB.settings.apiKey = $('#api-key').value.trim();
    DB.settings.model = $('#api-model').value;
    save();
    updateBanner();
    if (!hasKey()) return toast('請先貼上 API key');
    const btn = $('#key-test');
    btn.disabled = true; btn.textContent = '測試中…';
    try {
      await aiTestKey();
      toast('✅ 連線成功,API key 可用!');
    } catch (e) { toast(e.message); }
    btn.disabled = false; btn.textContent = '測試連線';
  };
  $('#backup-btn').onclick = async () => {
    const btn = $('#backup-btn');
    btn.disabled = true; btn.textContent = '打包中…';
    try {
      const blob = await exportBackup();
      downloadBlob(blob, `享瘦高手備份-${S.date}.json`);
      toast('備份檔已產生,請存到「檔案」App 的 iCloud 雲碟');
    } catch (e) { toast(`備份失敗:${e.message}`); }
    btn.disabled = false; btn.textContent = '⬇️ 備份到檔案';
  };
  $('#restore-btn').onclick = () => $('#restore-input').click();
  $('#restore-input').onchange = async () => {
    const file = $('#restore-input').files[0];
    if (!file) return;
    if (!(await confirmDialog('還原會把備份內容合併/覆蓋到目前資料,確定繼續?', '還原'))) return;
    try {
      const obj = JSON.parse(await file.text());
      const msg = await restoreFromObject(obj);
      toast(msg);
      S.chatLocal = DB.chat.map((c) => ({ ...c }));
      updateBanner();
      renderMe();
    } catch (e) { toast(e.message); }
  };
}

// ================= 初次設定 =================
function renderOnboarding() {
  tabbar.hidden = true;
  app.innerHTML = `
    <div style="text-align:center;padding:26px 0 18px">
      <div style="font-size:52px">💪</div>
      <h1>享瘦高手</h1>
      <div class="muted">你的隨身營養師 + 健身教練</div>
    </div>
    <div class="card">
      <h2>先認識你,才能幫你</h2>
      <div class="muted small" style="margin-bottom:12px">填好基本資料,教練會算出你的每日熱量與營養目標,並依此排菜單和訓練。資料只存在這支手機。</div>
      ${profileFormHTML(DB.profile || {})}
    </div>
    <div class="muted small" style="text-align:center;padding:0 10px 14px">下一步:到「我的」分頁貼上 Anthropic API key,教練就能開始工作。</div>`;
  bindProfileForm(() => {
    tabbar.hidden = false;
    switchTab(hasKey() ? 'today' : 'me');
    if (!hasKey()) toast('最後一步:貼上 API key(AI 設定)');
  });
}

// ================= 導覽 =================
function switchTab(tab) {
  S.tab = tab;
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  render();
}

function render() {
  ensureToday();
  if (!DB.profile) return renderOnboarding();
  tabbar.hidden = false;
  ({ today: renderToday, log: renderLog, plan: renderPlan, coach: renderCoach, me: renderMe }[S.tab] || renderToday)();
}

$$('#tabbar button').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

// ================= 啟動 =================
(function boot() {
  // 遷移:舊資料補上碳循環設定(intensity 預設偏激進),讓既有使用者自動升級。
  if (DB.profile && (!DB.targets || !DB.targets.cycle)) {
    if (!DB.profile.intensity) DB.profile.intensity = 'aggressive';
    DB.targets = calcTargets(DB.profile);
    save();
  }
  S.chatLocal = DB.chat.map((c) => ({ ...c }));
  updateBanner();
  $('#key-banner').onclick = () => switchTab('me');
  render();
  prunePhotos();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
