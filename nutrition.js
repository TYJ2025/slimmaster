// 熱量與營養目標計算 — Mifflin-St Jeor 公式 + 碳循環(carb cycling)
// 全部為估算，僅供日常參考，非醫療建議。

export const ACTIVITY_LEVELS = {
  sedentary: { label: '久坐(很少運動)', factor: 1.2 },
  light: { label: '輕度(每週運動 1-3 次)', factor: 1.375 },
  moderate: { label: '中度(每週運動 3-5 次)', factor: 1.55 },
  active: { label: '高度(每週運動 6-7 次)', factor: 1.725 },
  very_active: { label: '非常高(體力工作/每天訓練)', factor: 1.9 },
};

export const GOALS = {
  lose: { label: '減脂', sign: -1 },
  recomp: { label: '增肌減脂(重組)', sign: 0 },
  gain: { label: '增肌', sign: 1 },
  maintain: { label: '維持', sign: 0 },
};

// 每週體重變化速率(公斤)→ 每日熱量增減。1 kg 脂肪 ≈ 7700 kcal。
export const RATES = {
  slow: { label: '和緩(每週 0.25 kg)', kgPerWeek: 0.25 },
  moderate: { label: '標準(每週 0.5 kg)', kgPerWeek: 0.5 },
  fast: { label: '積極(每週 0.75 kg)', kgPerWeek: 0.75 },
};

// 安全下限,避免熱量目標過低
const MIN_CALORIES = { male: 1500, female: 1200 };

export function calcBMR({ gender, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

// ============ 碳循環設定 ============
// 三種碳日:高碳日(訓練日,大肌群重訓)、中碳日(中強度/有氧)、低碳日(休息或低強度有氧)。
// 蛋白質全週固定,碳水依碳日高低循環,脂肪與碳水反向(碳水低則脂肪略高)。
export const CARB_DAY_TYPES = {
  high: {
    key: 'high', label: '高碳日', emoji: '🍚',
    calFactor: 1.10,   // 相對 TDEE 的熱量比例
    fatPerKg: 0.5,     // 高碳日脂肪較低
    workout: 'strength',
    desc: '訓練燃料日,搭配重訓/大肌群訓練',
  },
  mid: {
    key: 'mid', label: '中碳日', emoji: '🍠',
    calFactor: 0.90,
    fatPerKg: 0.7,
    workout: 'mixed',
    desc: '中強度訓練或有氧日',
  },
  low: {
    key: 'low', label: '低碳日', emoji: '🥦',
    calFactor: 0.72,
    fatPerKg: 0.9,     // 低碳日脂肪較高以維持飽足與荷爾蒙
    workout: 'rest',
    desc: '休息或低強度有氧(LISS)日,肝醣較低不安排大重量',
  },
};

// 目標對整體熱量的位移(加在 calFactor 上):減脂整週偏低、增肌偏高。
const GOAL_CAL_SHIFT = { lose: -0.05, recomp: -0.02, gain: 0.08, maintain: 0 };

// 蛋白質(g/kg 體重),碳循環強調足量蛋白質保住肌肉。
const PROTEIN_PER_KG = { lose: 2.0, recomp: 1.9, gain: 1.8, maintain: 1.6 };

// 每週碳日樣式(索引 0 = 週一 … 6 = 週日)。強度越激進,低碳日越多、擺盪越大。
export const CARB_PATTERNS = {
  aggressive: {
    lose:     ['high', 'low', 'low', 'mid', 'low', 'high', 'low'],   // 2 高 / 1 中 / 4 低
    recomp:   ['high', 'low', 'low', 'mid', 'high', 'low', 'low'],   // 2 高 / 1 中 / 4 低
    gain:     ['high', 'mid', 'high', 'low', 'high', 'low', 'mid'],  // 3 高 / 2 中 / 2 低
    maintain: ['high', 'low', 'mid', 'low', 'high', 'low', 'low'],   // 2 高 / 1 中 / 4 低
  },
  balanced: {
    lose:     ['high', 'low', 'mid', 'high', 'low', 'mid', 'low'],   // 2 高 / 2 中 / 3 低
    recomp:   ['high', 'low', 'mid', 'high', 'low', 'mid', 'low'],
    gain:     ['high', 'mid', 'high', 'mid', 'high', 'low', 'mid'],  // 3 高 / 3 中 / 1 低
    maintain: ['mid', 'low', 'high', 'mid', 'low', 'high', 'mid'],   // 2 高 / 3 中 / 2 低
  },
  gentle: {
    lose:     ['mid', 'low', 'mid', 'high', 'low', 'mid', 'low'],    // 1 高 / 3 中 / 3 低
    recomp:   ['mid', 'low', 'mid', 'high', 'mid', 'low', 'mid'],
    gain:     ['high', 'mid', 'mid', 'high', 'mid', 'mid', 'low'],   // 2 高 / 4 中 / 1 低
    maintain: ['mid', 'low', 'mid', 'high', 'mid', 'low', 'mid'],
  },
};

export const INTENSITIES = {
  auto: { label: '依目標(標準)', pattern: 'balanced' },
  aggressive: { label: '偏激進(多低碳日)', pattern: 'aggressive' },
  gentle: { label: '溫和(均衡循環)', pattern: 'gentle' },
};

// 依「週一起始」的星期序取得碳日型別(週一=0 … 週日=6)。
export function weekIndexOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return (d.getDay() + 6) % 7;
}

// 依日期回傳碳日型別鍵(high/mid/low)。cycle 不存在時回 'mid'。
export function carbTypeForDate(dateStr, cycle) {
  if (!cycle?.pattern?.length) return 'mid';
  return cycle.pattern[weekIndexOf(dateStr)] || 'mid';
}

// 由某一碳日型別產生當日熱量與巨量營養素。
function dayTargetForType(typeKey, { tdee, gender, weightKg, goal }) {
  const def = CARB_DAY_TYPES[typeKey] || CARB_DAY_TYPES.mid;
  const shift = GOAL_CAL_SHIFT[goal] ?? 0;
  const floor = MIN_CALORIES[gender] || 1200;

  const proteinG = Math.round(weightKg * (PROTEIN_PER_KG[goal] ?? 1.8));
  const fatG = Math.round(weightKg * def.fatPerKg);

  let calorieTarget = Math.round(tdee * (def.calFactor + shift));
  if (calorieTarget < floor) calorieTarget = floor;

  // 碳水吃掉剩餘熱量,低碳日設地板避免歸零。
  const carbFloor = typeKey === 'low' ? Math.round(weightKg * 0.3) : 30;
  let carbG = Math.round((calorieTarget - proteinG * 4 - fatG * 9) / 4);
  if (carbG < carbFloor) carbG = carbFloor;

  // 以實際巨量重算熱量,確保頁面數字一致。
  const kcal = proteinG * 4 + carbG * 4 + fatG * 9;
  return {
    type: typeKey,
    label: def.label,
    emoji: def.emoji,
    workout: def.workout,
    desc: def.desc,
    calorieTarget: Math.round(kcal / 10) * 10,
    macros: { proteinG, carbG, fatG },
  };
}

// 建立整個碳循環設定(含每日型別與週平均)。
export function calcCarbCycle(profile) {
  const {
    gender = 'female', weightKg = 60, goal = 'maintain', intensity = 'auto',
  } = profile;
  const bmr = calcBMR(profile);
  const factor = (ACTIVITY_LEVELS[profile.activity] || ACTIVITY_LEVELS.light).factor;
  const tdee = Math.round(bmr * factor);

  const patternKey = (INTENSITIES[intensity] || INTENSITIES.auto).pattern;
  const pattern = (CARB_PATTERNS[patternKey] || CARB_PATTERNS.balanced)[goal]
    || CARB_PATTERNS.balanced.maintain;

  const byType = {};
  for (const key of ['high', 'mid', 'low']) {
    byType[key] = dayTargetForType(key, { tdee, gender, weightKg, goal });
  }

  const counts = pattern.reduce((a, t) => { a[t] = (a[t] || 0) + 1; return a; }, {});

  return {
    intensity, patternKey, pattern, byType, counts,
    weekdayLabels: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'],
  };
}

export function calcTargets(profile) {
  const { gender = 'female', activity = 'light', goal = 'maintain', weightKg = 60 } = profile;
  const bmr = calcBMR(profile);
  const factor = (ACTIVITY_LEVELS[activity] || ACTIVITY_LEVELS.light).factor;
  const tdee = Math.round(bmr * factor);

  // 碳循環設定:每日目標依碳日循環。
  const cycle = calcCarbCycle(profile);

  // 週平均熱量與巨量(供「每日目標」卡片、近 7 日長條、週報的參考線使用)。
  const sum = cycle.pattern.reduce((acc, t) => {
    const d = cycle.byType[t];
    acc.cal += d.calorieTarget;
    acc.p += d.macros.proteinG;
    acc.c += d.macros.carbG;
    acc.f += d.macros.fatG;
    return acc;
  }, { cal: 0, p: 0, c: 0, f: 0 });
  const n = cycle.pattern.length || 7;
  const calorieTarget = Math.round(sum.cal / n / 10) * 10;
  const macros = {
    proteinG: Math.round(sum.p / n),
    carbG: Math.round(sum.c / n),
    fatG: Math.round(sum.f / n),
  };

  return { bmr, tdee, calorieTarget, macros, cycle };
}

// 依日期取回當日有效目標(碳日型別 + 熱量 + 巨量)。相容舊資料(無 cycle 時回平均)。
export function targetsForDate(dateStr, targets) {
  if (!targets) return null;
  if (targets.cycle?.byType) {
    const key = carbTypeForDate(dateStr, targets.cycle);
    return targets.cycle.byType[key] || null;
  }
  return { type: null, label: '', emoji: '', calorieTarget: targets.calorieTarget, macros: targets.macros };
}
