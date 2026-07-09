// 熱量與營養目標計算 — Mifflin-St Jeor 公式
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

export function calcTargets(profile) {
  const { gender = 'female', activity = 'light', goal = 'maintain', rate = 'moderate', weightKg = 60 } = profile;
  const bmr = calcBMR(profile);
  const factor = (ACTIVITY_LEVELS[activity] || ACTIVITY_LEVELS.light).factor;
  const tdee = Math.round(bmr * factor);

  const sign = (GOALS[goal] || GOALS.maintain).sign;
  const kgPerWeek = (RATES[rate] || RATES.moderate).kgPerWeek;
  const dailyDelta = Math.round((kgPerWeek * 7700) / 7); // kcal/day

  let calorieTarget = tdee + sign * dailyDelta;
  const floor = MIN_CALORIES[gender] || 1200;
  if (calorieTarget < floor) calorieTarget = floor;
  calorieTarget = Math.round(calorieTarget / 10) * 10;

  // 蛋白質以體重為基準(增肌減脂需要足量蛋白質保住肌肉),
  // 但不超過總熱量的 40%;脂肪 25%,其餘給碳水。
  const gPerKg = goal === 'maintain' ? 1.2 : 1.6;
  let proteinG = Math.round(weightKg * gPerKg);
  proteinG = Math.min(proteinG, Math.round((calorieTarget * 0.4) / 4));
  const fatG = Math.round((calorieTarget * 0.25) / 9);
  const carbG = Math.max(0, Math.round((calorieTarget - proteinG * 4 - fatG * 9) / 4));

  return { bmr, tdee, calorieTarget, macros: { proteinG, carbG, fatG } };
}
