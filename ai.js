// AI 層:享瘦高手的人設、各任務 prompt、與 Anthropic API 的直連呼叫。
// 瀏覽器直接呼叫 API(CORS 由 anthropic-dangerous-direct-browser-access 允許),
// API key 只存在本機 localStorage,不經過任何中介伺服器。

import { ACTIVITY_LEVELS, GOALS, RATES, FOCUS_AREAS, CARB_DAY_TYPES, targetsForDate, carbTypeForDate } from './nutrition.js';
import { DB } from './store.js';

// 重點雕塑部位 → 訓練與飲食方針。
// 前提(務必誠實):脂肪無法指定部位消除,靠的是「全身減脂 + 該部位阻力訓練 + 減少水腫」。
export const FOCUS_RULES = {
  shape: {
    training: '以「瘦腿＋胸背維持」為主軸:每週 2 次臀腿重訓、1 次完整胸背重訓,另在有氧日加 1 次輕量推胸／姿勢練習,兩次胸部刺激至少間隔 48 小時。每天可做低強度開髖。胸肌與背肌訓練可改善支撐和姿勢,但不能保證乳房脂肪在減脂時完全不變。',
    diet: '優先採每日均衡、約 15% 的溫和熱量赤字,蛋白質約 1.6–2.0 g/kg,不靠斷食、極低脂或激進低碳換取快速下降。目標是慢速減脂並保留肌肉;乳房脂肪仍可能隨全身脂肪下降。飲酒熱量另計,不要靠少吃正餐補償。',
    lifestyle: '每週觀察體重、胸圍、腰圍與大腿圍的 4 週趨勢,不要用單日水腫判斷成敗。若胸部出現新腫塊、皮膚凹陷、乳頭異常分泌物或持續單側改變,應就醫評估。',
  },
  lower: {
    training: '重訓以「臀腿」為主軸:深蹲、羅馬尼亞硬舉、臀推、分腿蹲/弓箭步、腿推、腿彎舉、髖外展、小腿。下半身訓練量明顯高於上半身,但上半身與核心每週仍各至少 1 次,維持體態平衡,不可完全不練。有氧優先選「會用到臀腿、又不易讓大腿變粗」的形式:坡度快走、爬階、腳踏車中低阻力、游泳;避免長時間高阻力衝刺型踩踏。',
    diet: '下半身視覺很受「水腫」左右:控制鈉(醬料、湯麵湯底、加工肉、醃漬物、零食),多吃高鉀食物(香蕉、地瓜、菠菜、酪梨、番茄、豆類),水分要喝足(怕水腫而少喝反而更腫),纖維足量避免便祕腹脹。',
    lifestyle: '久坐是下半身循環的大敵:每小時起身走動 2-3 分鐘、避免翹腳、晚上抬腿 10 分鐘,長時間坐著可考慮壓力襪。',
  },
  upper: {
    training: '重訓以「背、肩、手臂」為主軸:划船、滑輪下拉/引體、肩推、側平舉、二頭彎舉、三頭下壓;搭配改善圓肩駝背的動作。下半身每週仍至少 1-2 次(深蹲或硬舉),維持全身代謝與力量基礎。',
    diet: '蛋白質務必足量以支撐上半身肌肉生長;整體仍以熱量赤字帶動全身減脂。',
    lifestyle: '注意辦公久坐造成的圓肩與上交叉症候群,每天做胸部與上背伸展。',
  },
  core: {
    training: '核心以「抗動作」訓練為主:棒式、死蟲、鳥狗、側棒、抗旋轉(Pallof press),搭配呼吸與骨盆控制;仰臥起坐類捲腹不需過量。全身複合動作(深蹲、硬舉、農夫走路)本身就是很好的核心訓練,每週保留。',
    diet: '腹部外觀受腹脹影響很大:注意易脹氣食物、進食速度、精緻糖與酒精;睡眠與壓力(皮質醇)也會影響腹部脂肪堆積。',
    lifestyle: '腰圍變化通常最慢,請看長期趨勢而非單日;睡眠 7 小時以上對腹部脂肪特別關鍵。',
  },
};

export function focusBlock() {
  const key = DB.profile?.focusArea;
  const rule = FOCUS_RULES[key];
  if (!rule) return null;
  const label = (FOCUS_AREAS[key] || {}).label || key;
  return [
    `【重點雕塑部位:${label}】這是學員特別在意的部位,規劃時要明顯偏重,但必須誠實:`,
    '脂肪無法「指定部位」消除(局部減脂在生理上不成立),該部位變緊實靠的是「全身減脂 + 該部位阻力訓練 + 減少水腫」三者並行。',
    '絕不可承諾「只瘦某個部位」或宣稱某個動作能消除該處脂肪;可以說明這樣做會讓該部位更緊實有線條。',
    `· 訓練方針:${rule.training}`,
    `· 飲食方針:${rule.diet}`,
    `· 生活方針:${rule.lifestyle}`,
  ].join('\n');
}

// 碳日 → 對應運動型別的方針(讓「當日飲食」決定「當日訓練」)。
export const CARB_WORKOUT_RULE = {
  steady: '均衡減脂日:飲食每天穩定,訓練不綁碳日;依週計畫安排臀腿、胸背、有氧與恢復,避免連續兩天高強度訓練同一肌群。',
  high: '重訓日(strength):練大肌群/多關節複合動作、可上大重量與較高訓練量,充分利用當天肝醣。',
  mid:  '中強度日(mixed / cardio):中等重量的小肌群或全身循環,或中強度有氧;訓練量適中。',
  low:  '低強度日(rest / cardio):完全休息,或只做低強度有氧(快走、飛輪 LISS)與伸展/活動度;肝醣低,不排大重量。',
};

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
export function weekdayOf(dateStr) {
  return WEEKDAYS[new Date(dateStr + 'T12:00:00').getDay()];
}

// ---- Anthropic API 直連 ----
export function extractJson(text) {
  if (!text) throw new Error('空回應,無法解析');
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

export function hasKey() {
  return !!(DB.settings.apiKey || '').trim();
}

// 對外:自動重試(暫時性錯誤才重試,如伺服器忙碌、請求太頻繁、逾時、連線問題)。
// 認證錯誤、模型錯誤、格式錯誤等「一定會再錯」的狀況不重試,直接把訊息丟出來讓使用者看到。
async function ask(opts) {
  const maxTry = opts.retries ?? 2;
  let lastErr;
  for (let i = 0; i <= maxTry; i++) {
    try {
      return await askOnce(opts);
    } catch (e) {
      lastErr = e;
      const transient = /忙碌|太頻繁|連不上|等太久沒有回應|串流中斷|API 錯誤 5/.test(e.message || '');
      if (i < maxTry && transient) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1))); // 1.5s、3s 退避
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function askOnce({ system, prompt, imageB64 = null, json = false, maxTokens = 8192, model = null, timeoutMs = 120000, stream = true }) {
  const key = (DB.settings.apiKey || '').trim();
  if (!key) throw new Error('尚未設定 API key。請到「我的」→ AI 設定,貼上你的 Anthropic API key。');

  const content = [];
  if (imageB64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } });
  content.push({ type: 'text', text: prompt });

  // 逾時保護:超時一律中止並回報,絕不讓請求「卡住」害按鈕失效
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const timeoutError = new Error('等太久沒有回應,已中止。請再按一次;產生過程請保持 App 畫面開著、不要鎖屏。');

  try {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: model || DB.settings.model || 'claude-sonnet-5',
          max_tokens: maxTokens,
          system: system || undefined,
          messages: [{ role: 'user', content }],
          ...(stream ? { stream: true } : {}),
        }),
      });
    } catch (e) {
      if (e.name === 'AbortError') throw timeoutError;
      throw new Error('連不上 Anthropic API,請確認手機有網路後再試。');
    }

    if (!res.ok) {
      let type = '', msg = '';
      try { const e = await res.json(); type = e?.error?.type || ''; msg = e?.error?.message || ''; } catch { /* 用預設訊息 */ }
      if (res.status === 401 || type === 'authentication_error') throw new Error('API key 無效或已停用,請到「我的」→ AI 設定檢查。');
      if (res.status === 429) throw new Error('請求太頻繁或額度用盡,請稍等再試。');
      if (res.status === 529 || type === 'overloaded_error') throw new Error('Anthropic 伺服器忙碌中,請稍等再試。');
      throw new Error(`API 錯誤 ${res.status}:${msg || type || '未知錯誤'}`);
    }

    let text = '', stopReason = '';
    if (!stream) {
      // 非串流:小請求最穩,一次拿完整 JSON,不經 SSE 解析
      let data;
      try { data = await res.json(); } catch (e) {
        if (e.name === 'AbortError') throw timeoutError;
        throw new Error('回應解析失敗,請再試一次。');
      }
      text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      stopReason = data.stop_reason || '';
    } else {
      // 讀取 SSE 串流,把文字增量拼起來
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let ev;
            try { ev = JSON.parse(payload); } catch { continue; }
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
            else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
            else if (ev.type === 'error') throw new Error(ev.error?.message || 'API 串流中斷,請再試一次。');
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') throw timeoutError;
        throw e;
      }
    }

    if (json && !text.trim()) {
      throw new Error(`模型沒有回傳內容${stopReason ? `(原因:${stopReason})` : ''},請再試一次。`);
    }
    return json ? extractJson(text) : text;
  } finally {
    clearTimeout(timer);
  }
}

// ---- 共用人設 ----
// dateStr 選填:帶入時會附上「當天碳日型別 + 當日熱量/巨量目標」,讓建議貼合當天碳循環。
export function personaPrompt(dateStr = null) {
  const p = DB.profile || {};
  const t = DB.targets || {};
  const cycle = t.cycle;
  const lines = [
    '你是「享瘦高手」,一位同時具備營養師與健身教練專業的私人教練。',
    '個性:專業、直接、溫暖但不囉唆。永遠用繁體中文(台灣用語)回答。',
    '飲食建議以台灣常見食材、超商與外食選項為主;運動建議兼顧居家與健身房情境。',
    '',
    '【學員資料】',
    `- 性別:${p.gender === 'male' ? '男' : '女'},年齡:${p.age} 歲,身高:${p.heightCm} cm,體重:${p.weightKg} kg`,
    `- 目標:${(GOALS[p.goal] || {}).label || p.goal}${p.targetWeightKg ? `(目標體重 ${p.targetWeightKg} kg)` : ''},速度:${(RATES[p.rate] || {}).label || ''}`,
    `- 活動量:${(ACTIVITY_LEVELS[p.activity] || {}).label || ''}`,
    `- 週平均熱量目標:${t.calorieTarget} kcal(BMR ${t.bmr} / TDEE ${t.tdee})`,
  ];
  if (p.restrictions) lines.push(`- 飲食限制/過敏:${p.restrictions}`);
  if (p.preferences) lines.push(`- 口味偏好:${p.preferences}`);
  if (p.equipment) lines.push(`- 可用運動器材:${p.equipment}`);
  if (p.scheduleNote) lines.push(`- 作息備註:${p.scheduleNote}`);

  // 重點雕塑部位方針
  const fb = focusBlock();
  if (fb) lines.push('', fb);

  // 飲食策略
  if (cycle?.patternKey === 'steady') {
    const d = cycle.byType.steady;
    lines.push(
      '',
      '【均衡減脂方針 — 本學員目前採用】',
      `每日約 ${d.calorieTarget} kcal(蛋白質 ${d.macros.proteinG} / 碳水 ${d.macros.carbG} / 脂肪 ${d.macros.fatG} g),不做高低碳擺盪。`,
      '以溫和熱量赤字、穩定蛋白質和規律阻力訓練慢速減脂;訓練依週計畫與恢復安排,不由碳日決定。',
      '不可承諾減脂時胸部脂肪完全不變;胸背訓練改善的是胸肌支撐與姿勢。',
    );
  } else if (cycle?.byType) {
    lines.push(
      '',
      '【碳循環(carb cycling)方針 — 這是本學員的核心飲食法】',
      '此學員採高/中/低碳循環,蛋白質全週固定,碳水依碳日高低循環,脂肪與碳水反向。',
      '「當天的碳日型別」同時決定「當天的訓練」— 飲食領導、訓練跟隨:',
      ...['high', 'mid', 'low'].map((k) => {
        const d = cycle.byType[k];
        return `  · ${d.label}:約 ${d.calorieTarget} kcal(蛋白質 ${d.macros.proteinG} / 碳水 ${d.macros.carbG} / 脂肪 ${d.macros.fatG} g)→ ${CARB_WORKOUT_RULE[k]}`;
      }),
      `本週碳日安排(週一→週日):${cycle.pattern.map((k, i) => `${cycle.weekdayLabels[i]}${CARB_DAY_TYPES[k].label}`).join('、')}`,
    );
  }

  // 當日目標
  if (dateStr && cycle?.byType) {
    const key = carbTypeForDate(dateStr, cycle);
    const d = targetsForDate(dateStr, t);
    if (d) {
      lines.push(
        '',
        `【今天(${dateStr})是${d.label}】目標約 ${d.calorieTarget} kcal,蛋白質 ${d.macros.proteinG} g / 碳水 ${d.macros.carbG} g / 脂肪 ${d.macros.fatG} g。`,
        `對應訓練:${CARB_WORKOUT_RULE[key]}`,
      );
    }
  }

  lines.push('', cycle?.patternKey === 'steady'
    ? '原則:採溫和熱量赤字、足量蛋白質與規律阻力訓練;不宣稱碳循環有額外減脂魔法。建議要具體可執行,不說空話。'
    : '原則:增肌減脂的核心是「熱量控制 + 足量蛋白質 + 規律阻力訓練」;碳循環只用來配合訓練安排。建議要具體可執行,不說空話。');
  return lines.join('\n');
}

// ---- 一週菜單 ----
export function aiWeekMeals({ dates, note, recentMeals }) {
  const dayList = dates.map((d) => `${d}(${weekdayOf(d)})`).join('、');
  const prompt = [
    `請為學員規劃一週三餐菜單,日期為:${dayList}。`,
    '',
    '規劃原則:',
    '1. 每天三餐加總貼近每日熱量目標(±5%),蛋白質達標。',
    '2. 食譜要「忙碌上班族做得出來」:步驟不超過 4 步,或直接給超商/外食的具體組合。',
    '3. 一週內菜色不重複,兼顧口味變化;遵守飲食限制與偏好。',
    '4. 每餐附一個小提示(tip):外食替代方案或備餐訣竅。',
    note ? `5. 本週特別需求:${note}` : '',
    recentMeals ? `\n最近實際吃過的餐點(避免重複、貼近口味):\n${recentMeals}` : '',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "summary": "本週菜單重點,一句話",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": { "name": "餐點名", "kcal": 400, "protein": 25, "carb": 40, "fat": 12, "ingredients": ["食材與份量"], "steps": ["步驟"], "tip": "外食替代或訣竅" },
        "lunch":     { "格式同 breakfast": "" },
        "dinner":    { "格式同 breakfast": "" }
      }
    }
  ]
}`,
    'days 必須包含上述全部 7 天,ingredients 最多 6 項、steps 最多 4 步。',
  ].filter(Boolean).join('\n');
  return ask({ system: personaPrompt(), prompt, json: true, timeoutMs: 300000 });
}

// ---- 一週運動計畫 ----
export function aiWeekWorkout({ dates, note }) {
  const dayList = dates.map((d) => `${d}(${weekdayOf(d)})`).join('、');
  const prompt = [
    `請為學員規劃一週運動計畫,日期為:${dayList}。`,
    '',
    '規劃原則:',
    '1. 每天都先安排相同的 10-12 分鐘低強度開髖與臀腿啟動:90/90 髖轉換、內收肌後坐、半跪髖屈肌伸展、雙腳臀橋、側躺抬腿;這 5 項必須出現在每天 items 的最前面。',
    '2. 若採均衡減脂,主訓練不綁碳日;依恢復安排每週 2 次臀腿重訓、1 次完整胸背重訓,並在另一天加入輕量推胸／姿勢動作。若採碳循環才依高、中、低碳調整強度。不要連續兩天高強度訓練同一肌群。',
    '3. 一週應包含 2-3 天重訓、1-3 天有氧、至少 1 天不做主訓練的恢復日;兩次胸部刺激至少間隔 48 小時。',
    '4. 每個動作都要有 howTo:一般人看得懂的動作要領(2-3 句,含常見錯誤提醒)。',
    '5. 每天給 timing:當天建議的運動時段,以及與用餐的搭配(如運動前 1 小時吃什麼、運動後 30 分鐘內補充什麼)。',
    '6. 開髖固定動作之外,重訓主項 3-5 個並標明組數次數;有氧標明強度與時間。不要宣稱局部減脂,以活動度、臀腿肌力與整體減脂改善腿部線條。',
    note ? `7. 本週特別需求:${note}` : '',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "summary": "本週訓練重點,一句話",
  "scheduleNote": "本週用餐與運動時間的整體建議(2-3 句)",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "type": "strength | cardio | mixed | rest",
      "focus": "訓練重點,如:下肢重訓 / 快走有氧 / 休息日",
      "duration": "約 40 分鐘",
      "timing": "建議 18:30 運動;運動前 1 小時吃半根香蕉,運動後 30 分鐘內補充蛋白質",
      "items": [
        { "name": "動作名", "detail": "3 組 x 12 下(組間休息 60-90 秒)", "howTo": "動作要領與常見錯誤", "muscles": "主要肌群" }
      ]
    }
  ]
}`,
    'days 必須包含上述全部 7 天;恢復日保留固定 5 項低強度開髖啟動,其後最多再加 1-2 個輕鬆活動。',
  ].filter(Boolean).join('\n');
  return ask({ system: personaPrompt(), prompt, json: true, timeoutMs: 300000 });
}

// ---- 單日菜單(分天產生,手機上較穩、不逾時)----
// dayTarget 選填:{ label, calorieTarget, macros:{proteinG,carbG,fatG}, type } — 依碳日出餐。
export function aiDayMeals({ date, note, recentMeals, usedNames, dayTarget = null }) {
  const targetLine = dayTarget
    ? `【今天是${dayTarget.label}】當日熱量目標約 ${dayTarget.calorieTarget} kcal,三餐加總要貼近:蛋白質 ${dayTarget.macros.proteinG} g、碳水 ${dayTarget.macros.carbG} g、脂肪 ${dayTarget.macros.fatG} g(±8%)。`
    : '原則:三餐加總貼近每日熱量目標(±5%)、蛋白質達標。';
  const carbGuide = dayTarget
    ? (dayTarget.type === 'steady'
        ? '均衡減脂日:三餐都要有蛋白質,搭配適量全穀澱粉、蔬果與好油脂;不要斷食、極低脂或為酒精大幅少吃。'
        : dayTarget.type === 'high'
        ? '高碳日:碳水拉高(全穀飯麵、地瓜、水果),脂肪壓低;把主要碳水放在訓練前後那一餐。'
        : dayTarget.type === 'low'
          ? '低碳日:大幅減少澱粉與含糖食物,以蛋白質+大量蔬菜+優質脂肪為主(如雞胸、蛋、魚、酪梨、堅果、橄欖油)。'
          : '中碳日:碳水適量,澱粉集中在一到兩餐,其餘以蛋白質與蔬菜為主。')
    : '';
  const prompt = [
    `請為學員規劃 ${date}(${weekdayOf(date)})這「一天」的三餐(早餐、午餐、晚餐)。`,
    targetLine,
    carbGuide,
    '食譜要忙碌上班族做得出來(步驟≤4,或直接給超商/外食組合);每餐附一個 tip。',
    (() => {
      const rule = FOCUS_RULES[DB.profile?.focusArea];
      return rule ? `另外配合學員的重點部位:${rule.diet}` : '';
    })(),
    note ? `本週特別需求:${note}` : '',
    usedNames ? `本週其他天已安排(請避免重複):${usedNames}` : '',
    recentMeals ? `最近實際吃過(避免重複、貼近口味):${recentMeals}` : '',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "date": "${date}",
  "carbDay": "${dayTarget?.type || ''}",
  "meals": {
    "breakfast": { "name": "餐點名", "kcal": 400, "protein": 25, "carb": 40, "fat": 12, "ingredients": ["食材與份量"], "steps": ["步驟"], "tip": "外食替代或訣竅" },
    "lunch":     { "格式同 breakfast": "" },
    "dinner":    { "格式同 breakfast": "" }
  }
}`,
    'ingredients 最多 6 項、steps 最多 4 步。',
  ].filter(Boolean).join('\n');
  // 串流 + 較長逾時:大份食譜 JSON 用串流較不會卡在整包等待而逾時。
  return ask({ system: personaPrompt(date), prompt, json: true, maxTokens: 8192, timeoutMs: 240000, stream: true });
}

// ---- 單日運動(分天產生)----
// dayTarget 選填:依當日碳日型別設計對應訓練(高碳=重訓、中碳=中強度/有氧、低碳=休息/低強度)。
export function aiDayWorkout({ date, note, weekSoFar, dayIndex, total, dayTarget = null }) {
  const carbLine = dayTarget
    ? (dayTarget.type === 'steady'
        ? `【今天是${dayTarget.label}】${CARB_WORKOUT_RULE.steady} 當天熱量約 ${dayTarget.calorieTarget} kcal、碳水 ${dayTarget.macros.carbG} g。`
        : `【今天是${dayTarget.label}】必須依碳日安排對應訓練:${CARB_WORKOUT_RULE[dayTarget.type]} 這一天的 type 請設為「${CARB_DAY_TYPES[dayTarget.type].workout}」為主(低碳日可在 rest 與 cardio 間擇一,整週至少保留 1 天完全休息)。當天熱量約 ${dayTarget.calorieTarget} kcal、碳水 ${dayTarget.macros.carbG} g,請據此決定訓練量。`)
    : (weekSoFar
        ? `本週前面幾天已安排:${weekSoFar}。請據此平衡整週:約 2-4 天重訓、1-3 天有氧、至少 1 天完全休息。`
        : '這是本週第一天,請開始安排,並讓整週約 2-4 天重訓、1-3 天有氧、至少 1 天完全休息。');
  const prompt = [
    `請為學員規劃 ${date}(${weekdayOf(date)})這「一天」的運動(這是本週第 ${dayIndex + 1}/${total} 天)。`,
    carbLine,
    dayTarget && weekSoFar ? `本週前面幾天已安排:${weekSoFar}。` : '',
    (() => {
      const key = DB.profile?.focusArea;
      const rule = FOCUS_RULES[key];
      if (!rule) return '';
      return `這一天的動作選擇要明顯偏重「${(FOCUS_AREAS[key] || {}).label}」:${rule.training} 若當天是休息或低強度日,伸展與活動度也以該部位為主。`;
    })(),
    '每天 items 最前面都必須安排相同的 10-12 分鐘低強度開髖與臀腿啟動:90/90 髖轉換、內收肌後坐、半跪髖屈肌伸展、雙腳臀橋、側躺抬腿。均衡減脂時主訓練依週計畫與恢復安排;若採碳循環才依高、中、低碳調整。不要連續兩天高強度訓練同一肌群。',
    '每個動作要有 howTo(2-3 句動作要領含常見錯誤);給 timing(建議時段與用餐搭配);固定開髖之外,重訓主項 3-5 個並標組數次數,有氧標強度與時間;恢復日最多再加 1-2 個輕鬆活動。不要宣稱局部減脂或保證胸部脂肪不變;以臀腿肌力改善腿部線條,以胸背訓練改善支撐與姿勢。',
    note ? `本週特別需求:${note}` : '',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "date": "${date}",
  "carbDay": "${dayTarget?.type || ''}",
  "type": "strength | cardio | mixed | rest",
  "focus": "訓練重點",
  "duration": "約 40 分鐘",
  "timing": "建議時段與用餐搭配",
  "items": [ { "name": "動作名", "detail": "3 組 x 12 下", "howTo": "動作要領與常見錯誤", "muscles": "主要肌群" } ]
}`,
  ].filter(Boolean).join('\n');
  return ask({ system: personaPrompt(date), prompt, json: true, maxTokens: 8192, timeoutMs: 240000, stream: true });
}

// ---- 分析一餐(照片/文字)----
export function aiAnalyzeMeal({ description, imageB64, mealType, eatenToday, date = null }) {
  const mealLabel = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心' }[mealType] || '一餐';
  const prompt = [
    imageB64
      ? `學員拍了${mealLabel}的照片請你分析。請仔細觀察照片中每一項食物與份量。`
      : `學員用文字描述了${mealLabel},請你分析。`,
    description ? `學員補充說明:「${description}」` : '',
    eatenToday ? `今天目前已吃:${eatenToday}` : '',
    '',
    '請估算每項食物的熱量與三大營養素,並以營養師 + 健身教練的身分,依「今天的飲食策略與當日目標」給出具體建議(advice):',
    '這餐與今天的熱量、蛋白質及碳水目標搭不搭?接下來這一天該怎麼調整?2-3 句,直接又實用。',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "name": "這餐的簡短名稱",
  "items": [ { "food": "食物", "portion": "份量", "calories": 300, "protein": 20, "carb": 30, "fat": 10 } ],
  "totalCalories": 650,
  "protein": 35, "carb": 60, "fat": 22,
  "advice": "給學員的具體建議"
}`,
  ].filter(Boolean).join('\n');
  return ask({ system: personaPrompt(date), prompt, imageB64, json: true, maxTokens: 2048, timeoutMs: 120000 });
}

// ---- 教練對話 ----
export function aiChat({ date, context, history, message }) {
  const prompt = [
    `【今天是 ${date}(${weekdayOf(date)})】`,
    context,
    '',
    '【最近對話】',
    history || '(這是第一則訊息)',
    '',
    `【學員最新訊息】${message}`,
    '',
    '請以「享瘦高手」的身分回覆。你可以回答任何飲食、運動、當日計畫的問題,並參考近期記錄給個人化建議。',
    '如果學員明確要求調整某天的餐點食譜或運動內容,除了回覆之外,同時在 JSON 中帶上修改後的完整內容;',
    '沒有要求調整就不要帶 mealUpdates / workoutUpdates。',
    '',
    '只回傳 JSON,不要任何其他文字,格式如下:',
    `{
  "reply": "給學員的回覆(繁體中文,具體、簡潔,可用換行分段)",
  "mealUpdates": [
    { "date": "YYYY-MM-DD", "mealType": "breakfast|lunch|dinner",
      "meal": { "name": "", "kcal": 0, "protein": 0, "carb": 0, "fat": 0, "ingredients": [], "steps": [], "tip": "" } }
  ],
  "workoutUpdates": [
    { "date": "YYYY-MM-DD",
      "day": { "date": "YYYY-MM-DD", "type": "strength|cardio|mixed|rest", "focus": "", "duration": "", "timing": "",
               "items": [ { "name": "", "detail": "", "howTo": "", "muscles": "" } ] } }
  ]
}`,
    'mealUpdates 與 workoutUpdates 為選填,只在學員要求調整時出現。',
    '若是均衡減脂日,請維持每日均衡目標與每週訓練安排;只有採碳循環時,才維持高／中／低碳日的定位。',
  ].join('\n');
  return ask({ system: personaPrompt(date), prompt, json: true, maxTokens: 4096, timeoutMs: 120000 });
}

// ---- 週報 ----
export function aiWeekReport({ days, weights }) {
  const dayLines = days
    .map((d) => `- ${d.date}(${weekdayOf(d.date)}):進食 ${d.totals.calories} kcal(蛋白質 ${d.totals.protein} g),記錄 ${d.mealCount} 餐,運動完成 ${d.workoutDoneCount}/${d.workoutTotal || 0} 項`)
    .join('\n');
  const weightLines = weights.length ? weights.map((w) => `- ${w.date}:${w.kg} kg`).join('\n') : '(本週沒有體重記錄)';
  const prompt = [
    '請根據以下一週數據,以教練身分寫一份簡短週報(繁體中文、純文字、不要 JSON):',
    '',
    '【每日進食與運動】',
    dayLines,
    '',
    '【體重記錄】',
    weightLines,
    '',
    '週報包含:1) 本週整體表現(先肯定做得好的地方) 2) 飲食與運動各一個最需要改進的點 3) 下週 2-3 個具體行動建議。全文 200 字以內。',
  ].join('\n');
  return ask({ system: personaPrompt(), prompt, maxTokens: 1024, timeoutMs: 90000 });
}

// ---- 測試 API key ----
export function aiTestKey() {
  return ask({ prompt: '回覆「OK」兩個字母就好。', maxTokens: 16, model: 'claude-haiku-4-5-20251001', timeoutMs: 30000 });
}
