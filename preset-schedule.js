// 免 API 預排：2026/8/15～8/30(下半身雕塑版)。
// 依使用者既有的高／中／低碳目標分配三餐；五、六、日保留飲酒彈性；
// 訓練以臀腿為主軸(每週 2 次下肢重訓)，並在飲食與生活面加入消水腫策略。
// 註：脂肪無法指定部位消除，下半身緊實靠「全身減脂＋臀腿訓練＋減少水腫」三者並行。

const MEAL_PRESET_ID = 'lower-body-2026-08-15-v1';
const HIP_WORKOUT_PRESET_ID = 'hip-opening-2026-08-15-v2';
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
  shrimp: { label: '熟蝦仁', p: 0.24, c: 0.01, f: 0.01 },
  // 全蛋蛋白質密度低,單用全蛋要吃到 5 顆才達標;改以「全蛋＋蛋白」組合,份量寫死較好執行。
  eggPlus: {
    label: '全蛋＋蛋白', p: 0.16, c: 0.01, f: 0.055,
    fixed: '全蛋 2 顆＋蛋白 3 份(或以 0.5 匙蛋白粉替代蛋白)',
    step: '蛋液以少油煎熟或烘烤,不要額外加大量奶油與起司。',
  },
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
  potato: { label: '熟馬鈴薯(帶皮)', p: 0.02, c: 0.17, f: 0.001 },
  pasta: { label: '熟全麥義大利麵', p: 0.06, c: 0.28, f: 0.011 },
};

const DAYS = [
  // ── 第一段:週末飲酒日(休息為主) ──
  {
    date: '2026-08-15', carbDay: 'low', drinking: true,
    meals: [
      ['酪梨莓果優格碗', 'yogurtBoost', 'berries', '酪梨薄片與肉桂粉', '酪梨與莓果補鉀,有助改善下半身水腫。'],
      ['蒜香蝦仁南瓜沙拉', 'shrimp', 'pumpkin', '菠菜、番茄與洋蔥', '沙拉醬自調(檸檬＋橄欖油),市售醬料鈉含量高。'],
      ['飲酒前豆腐蔬菜鍋', 'tofu', 'pumpkin', '白菜、金針菇與海帶芽', '湯只喝一半以控鈉;先吃完正餐再飲酒。'],
    ],
    workout: 'restGluteWalk',
  },
  {
    date: '2026-08-16', carbDay: 'low', drinking: true,
    meals: [
      ['菠菜番茄烘蛋', 'eggPlus', 'pumpkin', '菠菜、小番茄與黑胡椒', '菠菜高鉀低鈉,是消水腫的好食材。'],
      ['檸香鮭魚彩蔬盤', 'salmon', 'pumpkin', '蘆筍、彩椒與洋蔥', '鮭魚本身有油脂,烹調不必再加多油。'],
      ['飲酒前清蒸鱸魚', 'whiteFish', 'pumpkin', '青江菜、菇類與薑絲', '清蒸最能控鈉;飲酒時一杯酒配一杯水。'],
    ],
    workout: 'recovery',
  },

  // ── 第一週(8/17–8/23):下半身為主軸 ──
  {
    date: '2026-08-17', carbDay: 'low',
    meals: [
      ['無糖優格奇亞籽碗', 'yogurtBoost', 'berries', '奇亞籽與肉桂粉', '週一先補水、降鈉,把週末的水腫代謝掉。'],
      ['檸檬雞胸酪梨沙拉', 'chicken', 'pumpkin', '生菜、小黃瓜與酪梨', '酪梨補鉀;醬汁只用檸檬與黑胡椒。'],
      ['味噌豆腐菇菇湯', 'tofu', 'pumpkin', '白菜、鴻喜菇與海帶芽', '味噌減半,湯不喝完,今天以低鈉為目標。'],
    ],
    workout: 'recoveryGlute',
  },
  {
    date: '2026-08-18', carbDay: 'high',
    meals: [
      ['藍莓燕麥蛋白粥', 'yogurtBoost', 'oats', '藍莓與肉桂粉', '今天是下肢重訓日,早餐把碳水吃足。'],
      ['蔥爆牛肉糙米碗', 'leanBeef', 'brownRice', '青蔥、洋蔥與彩椒', '訓練前 2-3 小時吃,飯量照標示不要少吃。'],
      ['訓練後蝦仁義大利麵', 'shrimp', 'pasta', '番茄、菠菜與蒜片', '重訓後 1 小時內吃,補回臀腿肝醣。'],
    ],
    workout: 'lowerA',
  },
  {
    date: '2026-08-19', carbDay: 'mid',
    meals: [
      ['酪梨鮪魚全麥吐司', 'tuna', 'toast', '酪梨、番茄與黑胡椒', '不加美乃滋,改用無糖優格或酪梨提供油脂。'],
      ['香草鮭魚藜麥盤', 'salmon', 'quinoa', '青花菜與蘆筍', '香草與檸檬取代鹽,鈉降下來腿就不容易腫。'],
      ['雞胸地瓜溫沙拉', 'chicken', 'sweetPotato', '菠菜、彩椒與洋蔥', '地瓜高鉀,晚餐吃有助把多餘的鈉排掉。'],
    ],
    workout: 'upperCore',
  },
  {
    date: '2026-08-20', carbDay: 'high',
    meals: [
      ['香蕉可可燕麥杯', 'yogurt', 'oats', '香蕉半根與無糖可可粉', '香蕉補鉀又補碳水,訓練日早餐很適合。'],
      ['黑胡椒豬里肌糙米碗', 'pork', 'brownRice', '青花菜與紅蘿蔔', '黑胡椒調味取代醬油;高碳日飯量較多是為晚上重訓補肝醣。'],
      ['訓練後蒜香蝦仁烏龍', 'shrimp', 'udon', '高麗菜、菇類與蔥段', '訓練後補碳水;湯不要喝完以免鈉超標。'],
    ],
    workout: 'lowerB',
  },
  {
    date: '2026-08-21', carbDay: 'mid', drinking: true,
    meals: [
      ['菠菜蛋捲全麥吐司', 'eggPlus', 'toast', '菠菜、番茄與黑胡椒', '早餐蛋白質吃足,晚上比較不會亂吃。'],
      ['檸檬雞胸馬鈴薯沙拉', 'chicken', 'potato', '生菜、小黃瓜與甜椒', '馬鈴薯放涼再吃,抗性澱粉較多也較有飽足感。'],
      ['飲酒前烤鱸魚糙米餐', 'whiteFish', 'brownRice', '青花菜與菇類', '先吃完正餐再飲酒,一杯酒配一杯水。'],
    ],
    workout: 'inclineWalk',
  },
  {
    date: '2026-08-22', carbDay: 'low', drinking: true,
    meals: [
      ['希臘優格堅果莓果碗', 'yogurtBoost', 'berries', '肉桂粉與少量堅果', '堅果選無調味,鹽味堅果會讓水腫更明顯。'],
      ['檸檬鮭魚蘆筍盤', 'salmon', 'pumpkin', '蘆筍、菇類與洋蔥', '蘆筍利水,搭配充足水分效果更好。'],
      ['飲酒前蝦仁蔬菜鍋', 'shrimp', 'pumpkin', '白菜、金針菇與海帶芽', '不加加工丸餃(鈉極高);酒後不吃宵夜。'],
    ],
    workout: 'restGluteWalk',
  },
  {
    date: '2026-08-23', carbDay: 'low', drinking: true,
    meals: [
      ['番茄鮪魚生菜盤', 'tuna', 'pumpkin', '生菜、番茄與小黃瓜', '鮪魚罐頭選水煮並瀝乾,可再沖一下水降鈉。'],
      ['蒜香豬里肌時蔬', 'pork', 'pumpkin', '高麗菜與青花菜', '清蒸或乾煎,不搭配濃醬與勾芡。'],
      ['飲酒前薑絲魚湯', 'whiteFish', 'pumpkin', '白菜、菇類與薑絲', '若週五六已喝較多,今晚改無酒精飲料。'],
    ],
    workout: 'recovery',
  },

  // ── 第二週(8/24–8/30):下半身進階,組數與單腳動作加重 ──
  {
    date: '2026-08-24', carbDay: 'low',
    meals: [
      ['無糖優格酪梨碗', 'yogurtBoost', 'berries', '酪梨與奇亞籽', '週一是消水腫關鍵日:低鈉、高鉀、水喝足。'],
      ['蝦仁酪梨沙拉', 'shrimp', 'pumpkin', '生菜、番茄與酪梨', '蝦仁低脂高蛋白,適合低碳日的午餐。'],
      ['豆腐蔬菜味噌鍋', 'tofu', 'pumpkin', '白菜、菇類與海帶芽', '味噌減半;晚餐後抬腿 10 分鐘幫助循環。'],
    ],
    workout: 'recoveryGlute',
  },
  {
    date: '2026-08-25', carbDay: 'high',
    meals: [
      ['莓果燕麥蛋白杯', 'yogurtBoost', 'oats', '莓果與肉桂粉', '今天下肢重訓進階週,早餐碳水要吃滿。'],
      ['黑胡椒牛肉糙米碗', 'leanBeef', 'brownRice', '彩椒、洋蔥與青花菜', '黑胡椒取代醬油調味,鈉會低很多。'],
      ['訓練後鮭魚地瓜盤', 'salmon', 'sweetPotato', '菠菜與蘆筍', '訓練後蛋白質＋碳水一起吃,修復臀腿肌肉。'],
    ],
    workout: 'lowerA2',
  },
  {
    date: '2026-08-26', carbDay: 'mid',
    meals: [
      ['蛋沙拉全麥吐司', 'eggPlus', 'toast', '生菜、番茄與黑胡椒', '蛋沙拉用無糖優格拌,不加美乃滋。'],
      ['蒜香蝦仁藜麥沙拉', 'shrimp', 'quinoa', '菠菜、彩椒與小黃瓜', '藜麥可換等量糙米飯。'],
      ['香煎豬里肌地瓜餐', 'pork', 'sweetPotato', '青花菜與洋蔥', '地瓜補鉀;上半身訓練日一樣要吃足蛋白質。'],
    ],
    workout: 'upperCore',
  },
  {
    date: '2026-08-27', carbDay: 'high',
    meals: [
      ['香蕉燕麥蛋白粥', 'yogurtBoost', 'oats', '香蕉半根與肉桂粉', '香蕉補鉀,對容易腿腫的人特別有幫助。'],
      ['照燒雞胸糙米便當', 'chicken', 'brownRice', '高麗菜與紅蘿蔔', '照燒醬減半,避免糖與鈉一起超標;訓練日飯要吃足。'],
      ['訓練後牛肉番茄義大利麵', 'leanBeef', 'pasta', '番茄、菠菜與洋蔥', '重訓後補碳水,幫助後鏈肌群修復。'],
    ],
    workout: 'lowerB2',
  },
  {
    date: '2026-08-28', carbDay: 'mid', drinking: true,
    meals: [
      ['酪梨蛋全麥吐司', 'eggPlus', 'toast', '酪梨、番茄與黑胡椒', '酪梨提供好油脂與鉀,早餐吃很適合。'],
      ['香草雞胸藜麥碗', 'chicken', 'quinoa', '兩碗綜合蔬菜', '醬汁另放只用一半,避開凱薩醬。'],
      ['飲酒前清蒸鱸魚糙米', 'whiteFish', 'brownRice', '青菜與菇類', '先吃正餐再飲酒;不要空腹喝。'],
    ],
    workout: 'inclineWalk',
  },
  {
    date: '2026-08-29', carbDay: 'low', drinking: true,
    meals: [
      ['莓果優格蛋白碗', 'yogurtBoost', 'berries', '肉桂粉與奇亞籽', '奇亞籽補纖維,避免便祕造成腹脹。'],
      ['檸香鮭魚彩蔬盤', 'salmon', 'pumpkin', '蘆筍、彩椒與洋蔥', '用檸檬與香草調味,鹽只放一點點。'],
      ['飲酒前豆腐菇菇鍋', 'tofu', 'pumpkin', '白菜、菇類與海帶芽', '湯只喝一半;酒後只休息,不做訓練。'],
    ],
    workout: 'restGluteWalk',
  },
  {
    date: '2026-08-30', carbDay: 'low', drinking: true,
    meals: [
      ['番茄蝦仁溫沙拉', 'shrimp', 'pumpkin', '生菜、番茄與小黃瓜', '起床先喝一大杯水再吃早餐。'],
      ['蒜香豬里肌蔬菜盤', 'pork', 'pumpkin', '高麗菜與青花菜', '氣炸或乾煎,避免裹粉與濃醬。'],
      ['飲酒前薑絲鱸魚湯', 'whiteFish', 'pumpkin', '白菜、菇類與薑絲', '這是本段最後一天,明天起可請教練排新一週。'],
    ],
    workout: 'recovery',
  },
];

// 每天固定做同一套低強度髖部活動與臀腿啟動；主訓練強度才隨碳日調整。
const DAILY_HIP_ROUTINE = [
  ['每日開髖｜90/90 髖轉換', '2 組 x 每側 8 下', '坐直後讓雙膝左右緩慢倒向地面，維持腳掌位置並用髖部帶動；不要為了碰地而扭腰或彈震。', '髖關節活動度'],
  ['每日開髖｜內收肌後坐', '2 組 x 每側 8 下', '四足跪姿將一腿向側邊伸直，臀部緩慢向後坐再回來；背部保持自然，只做到大腿內側有輕微拉感。', '大腿內側、髖部'],
  ['每日開髖｜半跪髖屈肌伸展', '每側 30 秒 x 2', '半跪後先微收骨盆，再把重心輕移向前；不要拱腰或把前膝推得太遠。', '髖前側'],
  ['每日臀腿啟動｜雙腳臀橋', '2 組 x 12 下', '腳跟踩穩、吐氣收腹後抬髖，頂端夾臀一秒；不要用下背過度拱起。', '臀肌、腿後側'],
  ['每日臀腿啟動｜側躺抬腿', '2 組 x 每側 12 下', '身體保持一直線，腳尖微朝前並由臀部帶動抬腿；不要翻轉骨盆或甩腿。', '臀中肌、髖外側'],
];

const WORKOUTS = {
  // ── 下半身重點:蹲系主導(第一週) ──
  lowerA: {
    type: 'strength', focus: '下半身重訓 A・蹲系與臀中肌', duration: '約 45 分鐘',
    timing: '建議傍晚訓練;午餐與訓練間隔 2-3 小時,訓練後 1 小時內吃晚餐補碳水。',
    items: [
      ['高腳杯深蹲(10 kg 壺鈴)', '4 組 x 10–12 下', '壺鈴抱在胸前、膝蓋朝腳尖方向、髖部向後坐到大腿接近水平;不要膝蓋內夾或腳跟離地。', '股四頭肌、臀大肌'],
      ['保加利亞分腿蹲(徒手或手持 5 kg 啞鈴)', '3 組 x 每側 8–10 下', '後腳放椅面、重心壓在前腳跟,身體微前傾更能刺激臀部;不要讓前膝過度往前跑。', '臀大肌、股四頭肌'],
      ['壺鈴臀推(10 kg 置於髖部)', '4 組 x 12–15 下', '上背靠沙發或床邊、下巴微收,頂到最高停一秒夾緊臀部;不要用腰往上頂。', '臀大肌'],
      ['側躺髖外展', '3 組 x 每側 15 下', '身體側躺成一直線、腳尖朝前微微下壓再抬腿;不要讓骨盆後倒用大腿前側代償。', '臀中肌'],
      ['站姿提踵', '3 組 x 15–20 下', '腳跟抬到最高停一秒再受控放下;不要靠彈震完成。', '小腿'],
    ],
  },
  // ── 下半身重點:後鏈/髖鉸鏈主導(第一週) ──
  lowerB: {
    type: 'strength', focus: '下半身重訓 B・後鏈與單腳穩定', duration: '約 45 分鐘',
    timing: '建議傍晚訓練;高碳日把主要澱粉放在訓練前後兩餐。',
    items: [
      ['壺鈴羅馬尼亞硬舉(10 kg)', '4 組 x 10–12 下', '髖部向後推、壺鈴貼著大腿下滑,感覺腿後側被拉長;背要保持自然,不是蹲下去。', '腿後側、臀大肌'],
      ['單腳羅馬尼亞硬舉(手持 5 kg 啞鈴)', '3 組 x 每側 8–10 下', '支撐腳微彎、骨盆保持水平不外翻,可扶牆維持平衡;動作慢比重量重要。', '腿後側、臀中肌'],
      ['單腳臀橋', '3 組 x 每側 12 下', '骨盆保持水平再抬髖並夾臀;若腿後側抽筋就改雙腳臀橋。', '臀大肌、腿後側'],
      ['後跨弓箭步', '3 組 x 每側 10 下', '後腳向後跨並垂直下沉、前腳掌踩穩;不要左右晃動。', '臀大肌、股四頭肌'],
      ['單側提壺鈴走路(10 kg)', '3 組 x 每側 30–40 秒', '身體站高、不要歪向持重側,小步穩定前進。', '核心、臀中肌、握力'],
    ],
  },
  // ── 下半身重點:第二週進階(次數/停頓加重) ──
  lowerA2: {
    type: 'strength', focus: '下半身重訓 A+・蹲系進階', duration: '約 50 分鐘',
    timing: '建議傍晚訓練;第二週訓練量略增,若前一天腿仍很痠可減 1 組。',
    items: [
      ['高腳杯深蹲(10 kg 壺鈴)', '4 組 x 12–15 下(底部停 1 秒)', '底部停頓不放鬆再站起,能大幅增加臀腿刺激;停頓時膝蓋仍要朝腳尖。', '股四頭肌、臀大肌'],
      ['保加利亞分腿蹲(雙手各 5 kg 啞鈴)', '4 組 x 每側 10 下', '這週加上啞鈴負荷;上半身微前傾把重量放在前腳跟。', '臀大肌、股四頭肌'],
      ['壺鈴臀推(10 kg)', '4 組 x 15 下(頂點停 1 秒)', '頂點夾緊臀部停一秒再下放;肋骨收好,避免用腰代償。', '臀大肌'],
      ['側棒式抬腿', '3 組 x 每側 10 下', '側棒穩定後上方腿慢慢抬起放下;髖部不要往後掉。', '臀中肌、側腹'],
      ['單腳提踵', '3 組 x 每側 12 下', '扶牆單腳做,慢下慢上;不要用彈跳完成。', '小腿'],
    ],
  },
  lowerB2: {
    type: 'strength', focus: '下半身重訓 B+・後鏈進階', duration: '約 50 分鐘',
    timing: '建議傍晚訓練;訓練後補足蛋白質與碳水,幫助臀腿修復。',
    items: [
      ['壺鈴相撲硬舉(10 kg)', '4 組 x 12 下', '雙腳略寬、腳尖外開約 30 度,用髖部發力站起並夾臀;不要圓背拉起。', '臀大肌、腿內側'],
      ['單腳羅馬尼亞硬舉(5 kg 啞鈴)', '4 組 x 每側 10 下', '這週增加一組;下降時骨盆維持水平,感覺支撐腿的腿後側被拉開。', '腿後側、臀中肌'],
      ['臀橋行軍', '3 組 x 每側 10 下', '維持臀橋高度不掉,交替把膝蓋抬向胸口;骨盆不可左右歪斜。', '臀大肌、核心'],
      ['走路弓箭步', '3 組 x 每側 12 下', '每步下沉到後膝接近地面再前進;膝蓋不要內夾,空間不足可改原地。', '臀大肌、股四頭肌'],
      ['雙手農夫走路(10 kg 壺鈴＋5 kg 啞鈴)', '3 組 x 45 秒', '肩胛穩定、腹部收好、小步走;不要駝背或聳肩。', '核心、握力、全身'],
    ],
  },
  // ── 維持全身平衡:上肢＋核心(每週 1 次) ──
  upperCore: {
    type: 'strength', focus: '上肢與核心(維持全身平衡)', duration: '約 40 分鐘',
    timing: '傍晚訓練;下半身今天休息,讓臀腿為明後天的重訓恢復。',
    items: [
      ['單手壺鈴划船(10 kg)', '4 組 x 每側 10 下', '背部保持平直、把手肘拉向髖部並停一秒;不要用身體扭轉甩動。', '背肌、二頭肌'],
      ['啞鈴地板臥推(5 kg x 2)', '3 組 x 10–12 下', '仰躺、手肘約向下 45 度;推起時手腕保持直,不要聳肩。', '胸、肩、三頭肌'],
      ['啞鈴肩上推舉(5 kg x 2)', '3 組 x 10 下', '肋骨收好再向上推,避免過度拱腰;無法控制就改單手輪流。', '肩、三頭肌'],
      ['前臂棒式', '3 組 x 30–40 秒', '夾臀收腹,頭到腳跟一直線;腰一下沉就立刻休息。', '核心'],
      ['死蟲式', '3 組 x 每側 8 下', '腰背貼地、對側手腳慢慢伸直;腰拱起就縮小幅度。', '深層核心'],
    ],
  },
  // ── 飲酒日前:爬坡快走(12-3-30 風格,練臀腿又不易讓大腿變粗) ──
  inclineWalk: {
    type: 'cardio', focus: '跑步機爬坡快走(12-3-30 風格)', duration: '約 40 分鐘',
    timing: '下午或晚餐前完成;飲酒後不再運動,也不要駕車。',
    items: [
      ['跑步機爬坡快走', '30 分鐘・坡度 10–12%・時速 4.8–5.0 km/h', '身體站直、核心收好,讓臀部發力向前推;不要抓著扶手把體重撐掉,那會讓效果大打折扣。', '臀大肌、腿後側、心肺'],
      ['臀部與梨狀肌伸展', '每側 30 秒 x 2', '坐姿把腳踝放到對側膝上、背打直前傾;不要圓背硬壓。', '臀部、髖外側'],
      ['小腿與腿後側伸展', '每側 30 秒 x 2', '後腳跟踩地、腳尖朝前;不要彈震拉伸。', '小腿、腿後側'],
    ],
  },
  // ── 飲酒日:休息＋散步＋抬腿消水腫 ──
  restGluteWalk: {
    type: 'rest', focus: '休息＋散步＋抬腿消水腫', duration: '約 30–40 分鐘',
    timing: '白天或晚餐後散步;喝酒後只休息,不做訓練。',
    items: [
      ['戶外散步', '20–30 分鐘・非常輕鬆', '以能舒服交談的強度走;不追求速度,目的是促進下半身循環。', '全身活動、下肢循環'],
      ['靠牆抬腿', '10 分鐘', '躺下讓雙腿靠牆呈 L 形,放鬆呼吸;這是消下半身水腫最省力的方法。', '下肢循環'],
      ['髖屈肌伸展', '每側 30 秒 x 2', '前後跪姿、骨盆微收再前移;不要用腰往前頂。', '髖前側'],
    ],
  },
  // ── 週一:恢復＋臀部啟動 ──
  recoveryGlute: {
    type: 'cardio', focus: '恢復有氧＋臀部啟動', duration: '約 35 分鐘',
    timing: '白天或傍晚;週末飲酒後先補水,強度保持輕鬆即可。',
    items: [
      ['橢圓機或平地快走', '20–25 分鐘・非常輕鬆', '維持能完整說話的強度;不要用爆汗方式補償週末的飲食。', '心肺、下肢'],
      ['雙腳臀橋(徒手)', '2 組 x 15 下', '慢慢抬髖並在頂點夾臀一秒;這是啟動臀部、不是訓練,不要加重量。', '臀大肌'],
      ['靠牆抬腿', '10 分鐘', '雙腿靠牆呈 L 形放鬆;週一做特別能改善週末累積的腿部腫脹。', '下肢循環'],
      ['髖屈肌與腿後側伸展', '每側 30 秒 x 2', '久坐一天後把髖前側打開;動作到輕微拉感即可。', '髖前側、腿後側'],
    ],
  },
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
    type: 'strength', focus: '臀腿線條＋上肢維持重訓', duration: '約 45 分鐘',
    timing: '建議傍晚訓練；把高碳日澱粉集中在訓練前後兩餐。',
    items: [
      ['相撲高腳杯深蹲（10 kg 壺鈴）', '4 組 x 10 下', '站距略寬、腳尖微向外，膝蓋沿腳尖方向彎曲並把髖部向下坐；不要讓膝蓋內夾。', '臀肌、大腿內側、股四頭肌'],
      ['啞鈴地板臥推（5 kg x 2）', '3 組 x 8–12 下', '仰躺、手肘約向下 45 度，推起時手腕保持直；不要聳肩或撞擊啞鈴。', '胸、肩、三頭肌'],
      ['單手壺鈴划船（10 kg）', '3 組 x 每側 10 下', '背部保持平直，把手肘拉向髖部；不要用身體扭轉甩動。', '背肌、二頭肌'],
      ['啞鈴肩上推舉（5 kg x 2）', '3 組 x 8–10 下', '肋骨收好再向上推；若無法控制就改單手輪流，不要過度拱腰。', '肩、三頭肌'],
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
  const proteinStep = protein.step ? protein.step : protein.ready
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
    focus: `每日開髖瘦腿主軸＋${workout.focus}`,
    duration: `${workout.duration}（含每日開髖 10–12 分鐘）`,
    timing: `先完成每日開髖與臀腿啟動，再依當日強度進行主訓練。${workout.timing}`,
    items: [...DAILY_HIP_ROUTINE, ...workout.items].map(([name, detail, howTo, muscles]) => ({ name, detail, howTo, muscles })),
  };
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 本預排涵蓋的日期一律以新版覆蓋；
// 不在清單內的日期(例如已過去的 8/12–8/14)完全不動。
function mergeDays(plan, incoming) {
  if (!incoming.length) return 0;
  const incomingDates = new Set(incoming.map((day) => day.date));
  plan.days = plan.days.filter((day) => !incomingDates.has(day.date));
  plan.days.push(...incoming);
  plan.days.sort((a, b) => a.date.localeCompare(b.date));
  return incoming.length;
}

export function installPresetSchedule(db) {
  if (!db.profile || !db.targets) return false;
  db.settings ||= {};
  const applied = Array.isArray(db.settings.appliedPresetSchedules) ? db.settings.appliedPresetSchedules : [];
  const mealsApplied = applied.includes(MEAL_PRESET_ID);
  const hipWorkoutsApplied = applied.includes(HIP_WORKOUT_PRESET_ID);
  if (mealsApplied && hipWorkoutsApplied) return false;

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
    if (!mealsApplied) inserted += mergeDays(week.mealPlan, weekMeals);
    if (!hipWorkoutsApplied) inserted += mergeDays(week.workoutPlan, weekWorkouts);
    week.mealPlan.summary = `免 API 預排(下半身雕塑版)：依個人碳日目標分配三餐，五六日按 2 杯威士忌氣泡水安排；全段控鈉、補鉀(地瓜、馬鈴薯、香蕉、菠菜、酪梨)以減少下半身水腫。${restrictionNote}`;
    week.workoutPlan.summary = '每日先做 10–12 分鐘開髖與臀腿啟動；每週 2 次高碳臀腿重訓(蹲系＋後鏈)、1 次中碳上肢核心維持平衡，飲酒日只做爬坡快走或溫和恢復。器材為 10 kg 壺鈴、5 kg 啞鈴與跑步機／橢圓機。';
    week.workoutPlan.scheduleNote = '每日開髖可低強度進行，但高強度臀腿重訓仍需間隔恢復。脂肪無法指定部位消除：腿部線條靠「全身減脂＋臀腿訓練＋減少水腫」。飲酒前先吃正常正餐，酒後不訓練、不駕車；若宿醉、關節疼痛或明顯痠痛，就只散步或完全休息。';
  }

  db.settings.appliedPresetSchedules = [
    ...applied,
    ...(mealsApplied ? [] : [MEAL_PRESET_ID]),
    ...(hipWorkoutsApplied ? [] : [HIP_WORKOUT_PRESET_ID]),
  ];
  return inserted > 0;
}
