// 免 API 預排：2026/8/12～8/23。
// 依使用者既有的高／中／低碳目標分配三餐；五、六、日保留飲酒彈性。

const PRESET_ID = 'alcohol-friendly-2026-08-12-v1';
const SAFE_FLOOR = { male: 1500, female: 1200 };
// 兩杯 highball：每杯暫按 45 ml、40% 威士忌＋無糖氣泡水估算，約 200 kcal。
const ALCOHOL_RESERVE_KCAL = 200;
const MEAL_RATIOS = [0.28, 0.37, 0.35];

const FALLBACK_TARGETS = {
  high: { type: 'high', calorieTarget: 1800, macros: { proteinG: 110, carbG: 240, fatG: 44 } },
  mid:  { type: 'mid',  calorieTarget: 1600, macros: { proteinG: 110, carbG: 160, fatG: 58 } },
  low:  { type: 'low',  calorieTarget: 1400, macros: { proteinG: 110, carbG: 70,  fatG: 76 } },
};

// 每克熟食材的概略營養值；只用來換算容易執行的份量，頁面仍以個人目標為準。
const PROTEINS = {
  chicken: { label: '熟雞胸肉', p: 0.31, c: 0, f: 0.036 },
  tuna: { label: '水煮鮪魚（瀝乾）', p: 0.25, c: 0, f: 0.01, ready: true },
  whiteFish: { label: '鱸魚或其他白肉魚', p: 0.24, c: 0, f: 0.02 },
  leanBeef: { label: '瘦牛肉', p: 0.26, c: 0, f: 0.08 },
  pork: { label: '豬里肌', p: 0.27, c: 0, f: 0.06 },
  salmon: { label: '鮭魚', p: 0.25, c: 0, f: 0.13 },
  tofu: { label: '板豆腐', p: 0.12, c: 0.02, f: 0.07 },
  yogurt: {
    label: '低脂無糖希臘優格', p: 0.10, c: 0.04, f: 0.02, ready: true, sweet: true,
    fatFood: { label: '無調味堅果', fatPerGram: 0.5 },
  },
  yogurtBoost: {
    label: '無糖希臘優格＋乳清／植物蛋白', p: 0.15, c: 0.03, f: 0.02, ready: true, sweet: true,
    fixed: '無糖希臘優格 200 g＋乳清或植物蛋白粉 0.5–1 匙',
    fatFood: { label: '無調味堅果', fatPerGram: 0.5 },
  },
};

const CARBS = {
  brownRice: { label: '熟糙米飯', p: 0.026, c: 0.23, f: 0.009 },
  quinoa: { label: '熟藜麥', p: 0.044, c: 0.21, f: 0.019 },
  sweetPotato: { label: '熟地瓜', p: 0.016, c: 0.20, f: 0.001 },
  oats: { label: '燕麥片', p: 0.17, c: 0.66, f: 0.07 },
  toast: { label: '全麥吐司', p: 0.13, c: 0.43, f: 0.04, slices: true },
  udon: { label: '熟烏龍麵', p: 0.026, c: 0.21, f: 0.005 },
  pumpkin: { label: '熟南瓜', p: 0.01, c: 0.07, f: 0.001 },
  berries: { label: '莓果', p: 0.01, c: 0.10, f: 0.003 },
};

const DAYS = [
  {
    date: '2026-08-12', carbDay: 'mid',
    meals: [
      ['鮪魚地瓜溫沙拉', 'tuna', 'sweetPotato', '小黃瓜、番茄與生菜', '地瓜可前一晚蒸好冷藏。'],
      ['香檸雞胸糙米便當', 'chicken', 'brownRice', '花椰菜與甜椒', '外食可選烤雞便當，飯量照標示份量。'],
      ['薑蔥鱸魚藜麥盤', 'whiteFish', 'quinoa', '青江菜與菇類', '藜麥可換等量糙米飯。'],
    ],
    workout: 'coreCardio',
  },
  {
    date: '2026-08-13', carbDay: 'high',
    meals: [
      ['香蕉燕麥優格杯', 'yogurt', 'oats', '香蕉半根與肉桂粉', '乳糖不耐可換無糖高蛋白豆乳。'],
      ['照燒雞胸雙色飯', 'chicken', 'brownRice', '高麗菜與紅蘿蔔', '照燒醬減半，避免糖與鈉過量。'],
      ['番茄牛肉烏龍麵', 'leanBeef', 'udon', '番茄、洋蔥與青菜', '訓練後吃，醬汁以番茄和胡椒調味。'],
    ],
    workout: 'lowerStrength',
  },
  {
    date: '2026-08-14', carbDay: 'mid', drinking: true,
    meals: [
      ['鮪魚全麥蔬菜吐司', 'tuna', 'toast', '生菜、番茄與黑胡椒', '不加美乃滋，可用無糖優格取代。'],
      ['香料豬里肌糙米餐', 'pork', 'brownRice', '青花菜與菇類', '午餐正常吃，不要為晚上飲酒而空腹。'],
      ['飲酒前檸檬雞胸蔬菜飯', 'chicken', 'brownRice', '兩碗綜合蔬菜', '先吃完蛋白質與蔬菜再開始飲酒。'],
    ],
    workout: 'lightCardio',
  },
  {
    date: '2026-08-15', carbDay: 'low', drinking: true,
    meals: [
      ['莓果優格蛋白碗', 'yogurtBoost', 'berries', '肉桂粉少量', '優格選無加糖，堅果份量併入脂肪。'],
      ['香煎鮭魚南瓜沙拉', 'salmon', 'pumpkin', '生菜、洋蔥與甜椒', '鮭魚已有脂肪，烹調不必再加很多油。'],
      ['飲酒前豆腐菇菇鍋', 'tofu', 'pumpkin', '菇類、白菜與海帶芽', '先吃正餐，不搭配炸物或洋芋片。'],
    ],
    workout: 'restWalk',
  },
  {
    date: '2026-08-16', carbDay: 'low', drinking: true,
    meals: [
      ['鮪魚南瓜蛋白盤', 'tuna', 'pumpkin', '小黃瓜、番茄與萵苣', '可加檸檬汁與黑胡椒，不用甜沙拉醬。'],
      ['蒜香豬里肌蔬菜盤', 'pork', 'pumpkin', '高麗菜與花椰菜', '用氣炸、乾煎或水煮，避免裹粉。'],
      ['清蒸鮭魚豆腐青菜湯', 'salmon', 'pumpkin', '嫩豆腐、青菜與薑絲', '湯底清淡，飲酒時不再加宵夜。'],
    ],
    workout: 'recovery',
  },
  {
    date: '2026-08-17', carbDay: 'low',
    meals: [
      ['無糖優格莓果碗', 'yogurtBoost', 'berries', '肉桂粉少量', '起床先補水；若乳糖不耐改無糖豆乳。'],
      ['胡麻雞絲南瓜沙拉', 'chicken', 'pumpkin', '兩碗綜合生菜', '胡麻醬另外放，只用一半。'],
      ['鱸魚豆腐蔬菜湯', 'whiteFish', 'pumpkin', '豆腐、白菜與菇類', '清淡補水，不用加工火鍋料。'],
    ],
    workout: 'recoveryWalk',
  },
  {
    date: '2026-08-18', carbDay: 'high',
    meals: [
      ['蘋果肉桂燕麥優格杯', 'yogurt', 'oats', '蘋果半顆與肉桂粉', '訓練前若餓，可把部分水果留到運動前。'],
      ['台式雞胸糙米便當', 'chicken', 'brownRice', '高麗菜、豆芽與甜椒', '飯量較多是為晚間重訓補肝醣。'],
      ['黑胡椒豬里肌地瓜盤', 'pork', 'sweetPotato', '花椰菜與洋蔥', '安排在訓練後，醬汁不勾芡。'],
    ],
    workout: 'upperStrength',
  },
  {
    date: '2026-08-19', carbDay: 'mid',
    meals: [
      ['鮪魚全麥小黃瓜吐司', 'tuna', 'toast', '小黃瓜、番茄與生菜', '吐司不抹果醬，飲料選無糖。'],
      ['味噌鮭魚藜麥餐', 'salmon', 'quinoa', '青花菜與菇類', '味噌薄抹即可，避免鈉過高。'],
      ['蒜香雞胸地瓜沙拉', 'chicken', 'sweetPotato', '生菜、甜椒與洋蔥', '地瓜可換玉米或糙米。'],
    ],
    workout: 'zoneTwoCore',
  },
  {
    date: '2026-08-20', carbDay: 'high',
    meals: [
      ['芒果燕麥優格杯', 'yogurt', 'oats', '芒果丁與奇亞籽少量', '水果與燕麥一起吃，不另外加蜂蜜。'],
      ['牛肉彩椒糙米碗', 'leanBeef', 'brownRice', '彩椒、洋蔥與青菜', '瘦牛肉快炒，油與醬油都量取。'],
      ['雞胸番茄烏龍湯麵', 'chicken', 'udon', '番茄、菇類與青江菜', '訓練後補充，湯不用喝完。'],
    ],
    workout: 'fullBodyStrength',
  },
  {
    date: '2026-08-21', carbDay: 'mid', drinking: true,
    meals: [
      ['鮪魚地瓜蔬菜盤', 'tuna', 'sweetPotato', '小黃瓜、番茄與生菜', '早餐先把蛋白質吃足，降低晚間亂吃機率。'],
      ['香草雞胸藜麥沙拉', 'chicken', 'quinoa', '兩碗綜合蔬菜', '醬汁另放，避開凱薩醬。'],
      ['飲酒前清蒸鱸魚糙米餐', 'whiteFish', 'brownRice', '青菜與菇類', '先吃完正餐，飲酒一杯配一杯水。'],
    ],
    workout: 'lightCardio',
  },
  {
    date: '2026-08-22', carbDay: 'low', drinking: true,
    meals: [
      ['莓果優格清爽碗', 'yogurtBoost', 'berries', '肉桂粉少量', '無糖優格可換無糖豆乳加蛋白質食材。'],
      ['檸檬鮭魚南瓜餐', 'salmon', 'pumpkin', '蘆筍與菇類', '用檸檬、香草取代奶油醬。'],
      ['飲酒前嫩豆腐蔬菜鍋', 'tofu', 'pumpkin', '白菜、菇類與海帶芽', '不加加工丸餃，避免酒後續吃宵夜。'],
    ],
    workout: 'restWalk',
  },
  {
    date: '2026-08-23', carbDay: 'low', drinking: true,
    meals: [
      ['鮪魚南瓜生菜盤', 'tuna', 'pumpkin', '生菜、番茄與小黃瓜', '若前晚睡眠差，先補水再吃早餐。'],
      ['蒜香豬里肌南瓜餐', 'pork', 'pumpkin', '高麗菜與青花菜', '清蒸或乾煎，不搭配濃醬。'],
      ['飲酒前薑絲鱸魚蔬菜湯', 'whiteFish', 'pumpkin', '白菜、菇類與豆腐', '若週五六已喝較多，今天以無酒精飲料替代。'],
    ],
    workout: 'recovery',
  },
];

const WORKOUTS = {
  coreCardio: {
    type: 'mixed', focus: '橢圓機＋壺鈴核心啟動', duration: '約 40 分鐘',
    timing: '晚餐前完成；運動前不需額外加餐，結束後照菜單吃晚餐。',
    items: [
      ['橢圓機', '20 分鐘・可說短句但略喘', '阻力由低開始，軀幹保持直立並讓腳掌貼穩踏板；不要聳肩或只用手臂拉動。', '心肺、下肢'],
      ['壺鈴硬舉（10 kg）', '3 組 x 10 下', '壺鈴放在雙腳中間，髖部向後推後站起；背部保持自然，不要彎腰拉起。', '臀肌、腿後側'],
      ['死蟲式', '3 組 x 每側 8 下', '腰背貼地，對側手腳慢慢伸直；若腰拱起就縮小幅度。', '深層核心'],
      ['鳥狗式', '2 組 x 每側 8 下', '四足跪姿伸出對側手腳並保持骨盆水平；不要聳肩或扭腰。', '核心、背部'],
    ],
  },
  lowerStrength: {
    type: 'strength', focus: '下肢與臀腿重訓', duration: '約 45 分鐘',
    timing: '建議傍晚訓練；午晚餐的主要澱粉放在運動前後。',
    items: [
      ['高腳杯深蹲（10 kg 壺鈴）', '4 組 x 8–12 下', '壺鈴抱在胸前、膝蓋朝腳尖方向、髖部向後坐；不要膝蓋內夾。', '股四頭肌、臀肌'],
      ['壺鈴羅馬尼亞硬舉（10 kg）', '4 組 x 10–12 下', '髖部向後推、壺鈴貼近雙腿下降；不要彎腰或把動作做成蹲下。', '腿後側、臀肌'],
      ['後跨弓箭步（徒手／5 kg 啞鈴）', '3 組 x 每側 8–10 下', '後腳向後跨並垂直下沉；前膝保持穩定，不要晃動。', '臀肌、股四頭肌'],
      ['單腳臀橋', '3 組 x 每側 10 下', '骨盆保持水平再抬髖；若抽筋就改雙腳臀橋。', '臀肌、腿後側'],
      ['站姿提踵', '3 組 x 15 下', '腳跟慢慢抬高並停一秒，再受控下降；不要靠彈震完成。', '小腿'],
    ],
  },
  lightCardio: {
    type: 'cardio', focus: '飲酒日前爬坡快走', duration: '約 30–35 分鐘',
    timing: '下午或晚餐前完成；飲酒後不再運動，也不要駕車。',
    items: [
      ['跑步機爬坡快走', '25–30 分鐘・坡度 4–8%・能正常交談', '先用低坡度熱身，再逐步增加；扶手只用於上下機，不要全程抓住支撐。', '心肺、臀腿'],
      ['胸椎旋轉', '2 組 x 每側 8 下', '四足跪姿讓手肘向上打開，骨盆保持不動；不要硬扭下背。', '胸椎、肩背'],
      ['小腿伸展', '每側 30 秒 x 2', '後腳腳跟踩地、腳尖朝前；不要彈震拉伸。', '小腿'],
    ],
  },
  restWalk: {
    type: 'rest', focus: '休息＋餐後散步', duration: '約 20–30 分鐘',
    timing: '白天或晚餐後散步；喝酒後只休息，不做訓練。',
    items: [
      ['戶外散步／橢圓機', '20–30 分鐘・非常輕鬆', '以能舒服交談的強度活動；不追求步速、阻力或疲勞感。', '全身活動'],
      ['髖屈肌伸展', '每側 30 秒 x 2', '前後跪姿微收骨盆再前移；不要用腰向前頂。', '髖前側'],
    ],
  },
  recovery: {
    type: 'rest', focus: '完全休息與補水', duration: '約 10 分鐘',
    timing: '今天不安排訓練；若飲酒，先吃正餐並在每杯酒之間喝水。',
    items: [
      ['腹式呼吸', '5 分鐘', '鼻吸四秒、嘴吐六秒，讓腹部自然起伏；不要憋氣。', '放鬆'],
      ['全身溫和伸展', '5 分鐘', '每個姿勢只到輕微拉感；若疼痛或頭暈立即停止。', '全身'],
    ],
  },
  recoveryWalk: {
    type: 'cardio', focus: '週末後橢圓機恢復', duration: '約 20–25 分鐘',
    timing: '起床先補水，精神正常再於白天散步；若仍宿醉就只休息。',
    items: [
      ['橢圓機／平地走', '20–25 分鐘・非常輕鬆', '阻力維持低檔並以能完整說話為準；不要用爆汗方式補償週末飲食。', '心肺、下肢'],
      ['貓牛式', '2 組 x 8 下', '配合呼吸緩慢活動脊椎；不要快速甩動頸部。', '脊椎活動度'],
    ],
  },
  upperStrength: {
    type: 'strength', focus: '上肢與核心重訓', duration: '約 45 分鐘',
    timing: '建議傍晚訓練；把高碳日澱粉集中在訓練前後兩餐。',
    items: [
      ['啞鈴地板臥推（5 kg x 2）', '4 組 x 8–12 下', '仰躺、手肘約向下 45 度，推起時手腕保持直；不要聳肩或撞擊啞鈴。', '胸、肩、三頭肌'],
      ['單手壺鈴划船（10 kg）', '4 組 x 每側 10 下', '背部保持平直，把手肘拉向髖部；不要用身體扭轉甩動。', '背肌、二頭肌'],
      ['啞鈴肩上推舉（5 kg x 2）', '3 組 x 8–10 下', '肋骨收好再向上推；若無法控制就改單手輪流，不要過度拱腰。', '肩、三頭肌'],
      ['啞鈴二頭彎舉（5 kg x 2）', '3 組 x 10–12 下', '手肘固定在身體兩側並緩慢下降；不要擺動身體借力。', '二頭肌'],
      ['前臂棒式', '3 組 x 25–40 秒', '夾臀收腹並保持頭到腳跟一直線；腰下沉時立即休息。', '核心'],
    ],
  },
  zoneTwoCore: {
    type: 'mixed', focus: '划船機 Zone 2＋核心', duration: '約 40 分鐘',
    timing: '傍晚或晚餐前；保持中等強度，為隔天重訓保留體力。',
    items: [
      ['划船機', '5 分鐘暖身＋20 分鐘穩定划＋5 分鐘緩和', '先用腿推、再微微後傾、最後才拉手；回程依序伸手、前傾、屈膝，不要聳肩猛拉。', '心肺、背部、下肢'],
      ['側棒式', '3 組 x 每側 20–30 秒', '肩膀在手肘正上方、身體成一直線；髖部不要下沉。', '側腹、臀中肌'],
      ['死蟲式', '3 組 x 每側 8 下', '腰背貼地並慢慢伸展對側手腳；腰拱起就縮小幅度。', '深層核心'],
    ],
  },
  fullBodyStrength: {
    type: 'strength', focus: '全身重訓', duration: '約 50 分鐘',
    timing: '建議傍晚訓練；運動前後各安排一部分高碳日澱粉。',
    items: [
      ['高腳杯深蹲（10 kg 壺鈴）', '4 組 x 8–12 下', '壺鈴抱胸、髖膝同步彎曲、膝蓋對齊腳尖；不要膝蓋內夾。', '下肢、臀肌'],
      ['壺鈴羅馬尼亞硬舉（10 kg）', '4 組 x 10–12 下', '髖部向後推並保持背部自然；壺鈴不要離身體太遠。', '臀肌、腿後側'],
      ['啞鈴地板臥推（5 kg x 2）', '4 組 x 8–12 下', '手肘約向下 45 度，推起時手腕保持直；不要聳肩。', '胸、肩、三頭肌'],
      ['單手壺鈴划船（10 kg）', '4 組 x 每側 10 下', '將手肘拉向髖部並停一秒；不要旋轉身體借力。', '背肌、二頭肌'],
      ['單側提壺鈴走路（10 kg）', '3 組 x 每側 30–40 秒', '身體站高、肩胛穩定，小步前進；不要歪向持重側。', '握力、核心、全身'],
    ],
  },
};

function roundTo(value, step = 1) {
  return Math.max(step, Math.round(value / step) * step);
}

function splitTotal(total) {
  const a = Math.round(total * MEAL_RATIOS[0]);
  const b = Math.round(total * MEAL_RATIOS[1]);
  return [a, b, Math.max(0, total - a - b)];
}

function plannedTarget(db, carbDay, drinking) {
  const raw = db.targets?.cycle?.byType?.[carbDay] || FALLBACK_TARGETS[carbDay];
  const floor = SAFE_FLOOR[db.profile?.gender] || 1200;
  const reserve = drinking ? Math.min(ALCOHOL_RESERVE_KCAL, Math.max(0, raw.calorieTarget - floor)) : 0;
  const carbCut = carbDay === 'low' ? 0 : reserve * 0.4 / 4;
  const fatCut = (reserve - carbCut * 4) / 9;
  return {
    reserve: Math.round(reserve),
    protein: Math.round(raw.macros.proteinG),
    carb: Math.max(0, Math.round(raw.macros.carbG - carbCut)),
    fat: Math.max(0, Math.round(raw.macros.fatG - fatCut)),
  };
}

function servingText(food, grams) {
  if (food.fixed) return food.fixed;
  const amount = roundTo(grams, 5);
  if (food.slices) return `${food.label}約 ${Math.max(1, Math.round(amount / 30))} 片（約 ${amount} g）`;
  return `${food.label}約 ${amount} g`;
}

function buildMeal(spec, macro, drinking) {
  const [name, proteinKey, carbKey, vegetables, tip] = spec;
  const protein = PROTEINS[proteinKey];
  const carb = CARBS[carbKey];
  const determinant = protein.p * carb.c - protein.c * carb.p;
  let proteinGrams = (macro.p * carb.c - macro.c * carb.p) / determinant;
  let carbGrams = (macro.c * protein.p - macro.p * protein.c) / determinant;
  if (!Number.isFinite(proteinGrams) || proteinGrams < 0) proteinGrams = macro.p / protein.p;
  if (!Number.isFinite(carbGrams) || carbGrams < 0) carbGrams = Math.max(0, (macro.c - proteinGrams * protein.c) / carb.c);
  const foodFat = proteinGrams * protein.f + carbGrams * carb.f;
  const oilTeaspoons = Math.max(0, (macro.f - foodFat) / 5);
  const ingredients = [
    servingText(protein, proteinGrams),
    servingText(carb, carbGrams),
    vegetables,
  ];
  if (oilTeaspoons >= 0.5) {
    if (protein.fatFood) {
      const fatGrams = oilTeaspoons * 5;
      ingredients.push(`${protein.fatFood.label}約 ${roundTo(fatGrams / protein.fatFood.fatPerGram, 5)} g`);
    } else {
      ingredients.push(`橄欖油約 ${roundTo(oilTeaspoons, 0.5)} 茶匙`);
    }
  }
  const alcoholTip = drinking ? '本日酒精額度另計；不要空腹喝，超過預留量需再調整。' : '';
  const proteinStep = protein.ready
    ? (protein.sweet
        ? `${protein.label}與${carb.label}拌勻，冷藏或直接食用。`
        : `${protein.label}瀝乾後直接使用，不需額外加油。`)
    : `${protein.label}以清蒸、氣炸或少油煎熟，避免裹粉。`;
  const finishStep = protein.sweet
    ? '加入水果或肉桂增添風味，不另外加糖或蜂蜜。'
    : '依標示份量裝盤，使用胡椒、檸檬、蒜或香草調味。';
  return {
    name,
    kcal: macro.p * 4 + macro.c * 4 + macro.f * 9,
    protein: macro.p,
    carb: macro.c,
    fat: macro.f,
    ingredients,
    steps: [
      `先備妥${carb.label}與${vegetables}。`,
      proteinStep,
      finishStep,
    ],
    tip: [tip, alcoholTip].filter(Boolean).join(' '),
  };
}

function buildMealDay(db, spec) {
  const target = plannedTarget(db, spec.carbDay, spec.drinking);
  const p = splitTotal(target.protein);
  const c = splitTotal(target.carb);
  const f = splitTotal(target.fat);
  const meals = spec.meals.map((meal, i) => buildMeal(meal, { p: p[i], c: c[i], f: f[i] }, spec.drinking));
  const alcoholNote = spec.drinking
    ? (target.reserve > 0
        ? `三餐已預留約 ${target.reserve} kcal，供 2 杯威士忌氣泡水（每杯暫按 45 ml 威士忌＋無糖氣泡水）；倒得更濃需另計。`
        : `當日目標已接近女性 1200 kcal 下限，三餐不再扣熱量；2 杯威士忌氣泡水約額外增加 ${ALCOHOL_RESERVE_KCAL} kcal，可改 1 杯或縮小酒量。`)
    : '';
  return {
    date: spec.date,
    carbDay: spec.carbDay,
    drinkingPlanned: !!spec.drinking,
    alcoholReserveKcal: target.reserve,
    alcoholNote,
    meals: { breakfast: meals[0], lunch: meals[1], dinner: meals[2] },
  };
}

function buildWorkoutDay(spec) {
  const workout = WORKOUTS[spec.workout];
  return {
    date: spec.date,
    carbDay: spec.carbDay,
    type: workout.type,
    focus: workout.focus,
    duration: workout.duration,
    timing: workout.timing,
    items: workout.items.map(([name, detail, howTo, muscles]) => ({ name, detail, howTo, muscles })),
  };
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mergeDays(plan, incoming) {
  const existing = new Set(plan.days.map((day) => day.date));
  let inserted = 0;
  for (const day of incoming) {
    if (existing.has(day.date)) continue;
    plan.days.push(day);
    inserted++;
  }
  plan.days.sort((a, b) => a.date.localeCompare(b.date));
  return inserted;
}

export function installPresetSchedule(db) {
  if (!db.profile || !db.targets) return false;
  db.settings ||= {};
  const applied = Array.isArray(db.settings.appliedPresetSchedules) ? db.settings.appliedPresetSchedules : [];
  if (applied.includes(PRESET_ID)) return false;

  const mealDays = DAYS.map((day) => buildMealDay(db, day));
  const workoutDays = DAYS.map(buildWorkoutDay);
  const weekStarts = [...new Set(DAYS.map((day) => mondayOf(day.date)))];
  const restrictionNote = db.profile.restrictions
    ? ` 已記錄飲食限制「${db.profile.restrictions}」，食用前請逐項確認食材。`
    : '';
  let inserted = 0;

  for (const weekStart of weekStarts) {
    const week = db.weeks[weekStart] ||= { mealPlan: null, workoutPlan: null };
    week.mealPlan ||= { summary: '', days: [] };
    week.workoutPlan ||= { summary: '', scheduleNote: '', days: [] };
    const weekMeals = mealDays.filter((day) => mondayOf(day.date) === weekStart);
    const weekWorkouts = workoutDays.filter((day) => mondayOf(day.date) === weekStart);
    inserted += mergeDays(week.mealPlan, weekMeals);
    inserted += mergeDays(week.workoutPlan, weekWorkouts);
    week.mealPlan.summary = `免 API 預排：依個人碳日目標分配三餐，五六日按 2 杯威士忌氣泡水安排。${restrictionNote}`;
    week.workoutPlan.summary = '48 歲女性飲酒友善週期：使用 10 kg 壺鈴、5 kg 啞鈴及健身房有氧器材，重訓放在非飲酒日。';
    week.workoutPlan.scheduleNote = '飲酒前先完成正常正餐；酒後不訓練、不駕車，隔天若宿醉就改為完全休息；任何動作引起疼痛時立即停止。';
  }

  db.settings.appliedPresetSchedules = [...applied, PRESET_ID];
  return inserted > 0;
}
