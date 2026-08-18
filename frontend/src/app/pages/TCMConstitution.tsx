/**
 * 中医体质辨识页面
 * TCM Constitution Assessment
 * 基于中华中医药学会《中医体质分类与判定》标准 (ZYYXH/T157-2009)
 * 王琦教授团队研发，北京中医药大学
 * 中医体质量表 (CCMQ) 完整版
 */

import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import { getToken } from "../../lib/auth";
import apiData from "../../../data/address.json";
import {
  HeartPulse,
  ChevronRight,
  ChevronLeft,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { calculateCalibratedConstitutionConfidence } from "../utils/tcmConstitutionConfidence.js";

const API = apiData.apiBaseUrl || "http://localhost:8081/api/v1";
function authHeaders() {
  const t = getToken();
  return t ? { "Content-Type": "application/json", Authorization: `Bearer ${t}` } : { "Content-Type": "application/json" };
}

// ==================== 九种体质类型定义 ====================

interface ConstitutionType {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  advice: string;
  adviceEn: string;
  color: string;
  icon: string;
}

const constitutionTypes: ConstitutionType[] = [
  {
    id: "neutral",
    name: "平和质",
    nameEn: "Neutral (Ping He)",
    description: "阴阳气血调和，体态适中，面色润泽，精力充沛",
    descriptionEn: "Balanced yin-yang and qi-blood, moderate build, radiant complexion, energetic",
    features: ["面色红润", "精力充沛", "睡眠良好", "性格开朗", "适应力强"],
    featuresEn: ["Radiant complexion", "Energetic", "Good sleep", "Cheerful", "Adaptable"],
    advice: "保持良好的生活习惯，均衡饮食，适度运动，保持心情愉悦。",
    adviceEn: "Maintain good lifestyle habits, balanced diet, moderate exercise, and a cheerful mood.",
    color: "bg-green-50 border-green-400 text-green-800",
    icon: "☯",
  },
  {
    id: "qi_deficiency",
    name: "气虚质",
    nameEn: "Qi Deficiency (Qi Xu)",
    description: "元气不足，疲乏气短，容易感冒，面色偏白",
    descriptionEn: "Insufficient yuan qi, fatigue, shortness of breath, prone to colds, pale complexion",
    features: ["容易疲劳", "气短懒言", "容易感冒", "活动易出汗", "头晕心慌"],
    featuresEn: ["Fatigue easily", "Shortness of breath", "Prone to colds", "Sweat with activity", "Dizzy/palpitations"],
    advice: "宜食益气健脾食物（黄芪、党参、山药、大枣），避免过度劳累，适量运动如太极、八段锦，忌大汗淋漓。",
    adviceEn: "Eat qi-tonifying foods (astragalus, codonopsis, yam, jujube), avoid overwork, practice tai chi or baduanjin.",
    color: "bg-yellow-50 border-yellow-400 text-yellow-800",
    icon: "💨",
  },
  {
    id: "yang_deficiency",
    name: "阳虚质",
    nameEn: "Yang Deficiency (Yang Xu)",
    description: "阳气不足，手足不温，畏寒怕冷，面色柔白",
    descriptionEn: "Insufficient yang qi, cold hands and feet, aversion to cold, pale complexion",
    features: ["畏寒怕冷", "手足不温", "喜热饮食", "精神不振", "夜尿频多"],
    featuresEn: ["Aversion to cold", "Cold extremities", "Prefer warm food", "Low spirit", "Frequent nighttime urination"],
    advice: "宜食温阳食物（羊肉、生姜、桂圆、韭菜），注意保暖，避免生冷食物，可艾灸关元、气海、命门。",
    adviceEn: "Eat warming foods (lamb, ginger, longan, leek), keep warm, avoid cold/raw foods, try moxibustion.",
    color: "bg-blue-50 border-blue-400 text-blue-800",
    icon: "❄️",
  },
  {
    id: "yin_deficiency",
    name: "阴虚质",
    nameEn: "Yin Deficiency (Yin Xu)",
    description: "阴液亏少，口燥咽干，手足心热，体形偏瘦",
    descriptionEn: "Yin fluid deficiency, dry mouth and throat, hot palms and soles, thin build",
    features: ["口燥咽干", "手足心热", "体形偏瘦", "大便干燥", "潮热盗汗"],
    featuresEn: ["Dry mouth/throat", "Hot palms/soles", "Thin build", "Dry stool", "Night sweats"],
    advice: "宜食滋阴食物（银耳、百合、枸杞、黑芝麻），避免辛辣燥热食物，保持充足睡眠，忌熬夜。",
    adviceEn: "Eat yin-nourishing foods (tremella, lily, goji, black sesame), avoid spicy/heating foods, ensure adequate sleep.",
    color: "bg-red-50 border-red-300 text-red-700",
    icon: "🔥",
  },
  {
    id: "phlegm_damp",
    name: "痰湿质",
    nameEn: "Phlegm-Damp (Tan Shi)",
    description: "痰湿凝聚，体形肥胖，腹部肥满，口黏苔腻",
    descriptionEn: "Phlegm-damp accumulation, overweight, full abdomen, sticky mouth, greasy tongue coating",
    features: ["体形肥胖", "腹部肥满", "口黏苔腻", "嗜食肥甘", "身重不爽"],
    featuresEn: ["Overweight", "Full abdomen", "Sticky mouth", "Crave rich food", "Feeling heavy"],
    advice: "宜食健脾利湿食物（薏米、冬瓜、陈皮、荷叶），减少甜腻食物，增加运动，可按摩足三里、丰隆。",
    adviceEn: "Eat damp-draining foods (barley, winter melon, tangerine peel, lotus leaf), reduce sweets, increase exercise.",
    color: "bg-amber-50 border-amber-400 text-amber-800",
    icon: "💧",
  },
  {
    id: "damp_heat",
    name: "湿热质",
    nameEn: "Damp-Heat (Shi Re)",
    description: "湿热内蕴，面垢油光，口苦口干，苔黄腻",
    descriptionEn: "Damp-heat accumulation, oily face, bitter/dry mouth, yellow greasy tongue coating",
    features: ["面垢油光", "口苦口干", "易生痤疮", "大便黏滞", "小便短赤"],
    featuresEn: ["Oily face", "Bitter/dry mouth", "Prone to acne", "Sticky stool", "Dark urine"],
    advice: "宜食清热利湿食物（绿豆、苦瓜、薏米、赤小豆），避免辛辣油腻，保持皮肤清洁，适量运动出汗。",
    adviceEn: "Eat heat-clearing foods (mung bean, bitter melon, barley, adzuki bean), avoid spicy/greasy foods.",
    color: "bg-orange-50 border-orange-400 text-orange-800",
    icon: "🌡️",
  },
  {
    id: "blood_stasis",
    name: "血瘀质",
    nameEn: "Blood Stasis (Xue Yu)",
    description: "血行不畅，肤色晦暗，容易出现瘀斑，口唇暗淡",
    descriptionEn: "Poor blood circulation, dull complexion, prone to bruises, dark lips",
    features: ["肤色晦暗", "容易出现瘀斑", "口唇暗淡", "眼眶暗黑", "肌肤甲错"],
    featuresEn: ["Dull complexion", "Bruise easily", "Dark lips", "Dark circles", "Rough skin"],
    advice: "宜食活血化瘀食物（山楂、黑木耳、玫瑰花茶、醋），适量运动促进血液循环，避免久坐，可按摩血海、三阴交。",
    adviceEn: "Eat blood-invigorating foods (hawthorn, wood ear mushroom, rose tea), exercise regularly.",
    color: "bg-purple-50 border-purple-400 text-purple-800",
    icon: "🩸",
  },
  {
    id: "qi_stagnation",
    name: "气郁质",
    nameEn: "Qi Stagnation (Qi Yu)",
    description: "气机郁滞，神情抑郁，忧虑脆弱，形体偏瘦",
    descriptionEn: "Qi stagnation, depressed mood, anxious, thin build",
    features: ["神情抑郁", "忧虑脆弱", "烦闷不乐", "胸胁胀满", "多愁善感"],
    featuresEn: ["Depressed mood", "Anxious", "Unhappy", "Chest tightness", "Sensitive"],
    advice: "宜食行气解郁食物（佛手、萝卜、柑橘、薄荷），多参加社交活动，听舒缓音乐，练习冥想，保持情志舒畅。",
    adviceEn: "Eat qi-moving foods (bergamot, radish, citrus, mint), socialize, listen to soothing music, meditate.",
    color: "bg-indigo-50 border-indigo-400 text-indigo-800",
    icon: "🍃",
  },
  {
    id: "special",
    name: "特禀质",
    nameEn: "Special/Allergic (Te Bing)",
    description: "先天禀赋不足，过敏体质，容易对花粉、食物等过敏",
    descriptionEn: "Congenital sensitivity, allergic constitution, prone to pollen/food allergies",
    features: ["过敏体质", "打喷嚏流涕", "皮肤易起疹", "哮喘", "对季节敏感"],
    featuresEn: ["Allergic", "Sneezing/runny nose", "Skin rashes", "Asthma", "Season-sensitive"],
    advice: "避免接触过敏原，宜食益气固表食物（黄芪、大枣、防风），增强体质，注意环境卫生，季节交替时加强防护。",
    adviceEn: "Avoid allergens, eat qi-strengthening foods (astragalus, jujube, saposhnikovia), boost immunity.",
    color: "bg-pink-50 border-pink-400 text-pink-800",
    icon: "🌸",
  },
];

// ==================== 标准量表题目 (ZYYXH/T157-2009) ====================

interface AssessmentQuestion {
  id: number;
  text: string;
  textEn: string;
  category: string;
  /** 平和质的反向计分条目：回答越严重，平和质得分越低 */
  reverse?: boolean;
}

const questions: AssessmentQuestion[] = [
  // ===== A型：平和质 (8项) =====
  { id: 1, text: "您精力充沛吗？", textEn: "Do you feel energetic?", category: "neutral" },
  { id: 2, text: "您容易疲乏吗？", textEn: "Do you easily feel tired?", category: "neutral", reverse: true },
  { id: 3, text: "您说话声音低弱无力吗？", textEn: "Is your speaking voice soft and weak?", category: "neutral", reverse: true },
  { id: 4, text: "您感到闷闷不乐吗？", textEn: "Do you feel gloomy or down?", category: "neutral", reverse: true },
  { id: 5, text: "您比一般人耐受不了寒冷吗？", textEn: "Are you less tolerant of cold than others?", category: "neutral", reverse: true },
  { id: 6, text: "您能适应外界自然和社会环境的变化吗？", textEn: "Can you adapt to changes in the environment?", category: "neutral" },
  { id: 7, text: "您容易失眠吗？", textEn: "Do you have trouble falling or staying asleep?", category: "neutral", reverse: true },
  { id: 8, text: "您容易忘事（健忘）吗？", textEn: "Do you easily forget things?", category: "neutral", reverse: true },
  // ===== B型：气虚质 (8项) =====
  { id: 9, text: "您容易感到疲乏吗？", textEn: "Do you easily feel fatigued?", category: "qi_deficiency" },
  { id: 10, text: "您容易气短（呼吸短促、接不上气）吗？", textEn: "Do you easily feel short of breath?", category: "qi_deficiency" },
  { id: 11, text: "您容易心慌吗？", textEn: "Do you easily feel palpitations?", category: "qi_deficiency" },
  { id: 12, text: "您容易头晕或站起时眩晕吗？", textEn: "Do you easily feel dizzy when standing up?", category: "qi_deficiency" },
  { id: 13, text: "您比别人容易患感冒吗？", textEn: "Are you more prone to colds than others?", category: "qi_deficiency" },
  { id: 14, text: "您喜欢安静、懒得说话吗？", textEn: "Do you prefer quiet and feel reluctant to speak?", category: "qi_deficiency" },
  { id: 15, text: "您说话声音低弱无力吗？", textEn: "Is your speaking voice low and weak?", category: "qi_deficiency" },
  { id: 16, text: "您活动量稍大就容易出虚汗吗？", textEn: "Do you easily sweat with slight activity?", category: "qi_deficiency" },
  // ===== C型：阳虚质 (7项) =====
  { id: 17, text: "您手脚发凉吗？", textEn: "Do your hands and feet feel cold?", category: "yang_deficiency" },
  { id: 18, text: "您胃脘部、背部或腰膝部怕冷吗？", textEn: "Do your stomach, back, or knees feel cold?", category: "yang_deficiency" },
  { id: 19, text: "您比一般人耐受不了寒冷吗？", textEn: "Are you less tolerant of cold than others?", category: "yang_deficiency" },
  { id: 20, text: "您吃（喝）凉的东西会感到不舒服或者怕吃凉的吗？", textEn: "Do you feel uncomfortable eating or drinking cold things?", category: "yang_deficiency" },
  { id: 21, text: "您受凉或吃凉的东西后，容易拉肚子吗？", textEn: "Do you easily get diarrhea after cold exposure or cold food?", category: "yang_deficiency" },
  { id: 22, text: "您比一般人耐受不了冬天的寒冷或夏天的冷空调吗？", textEn: "Are you less tolerant of winter cold or AC in summer?", category: "yang_deficiency" },
  { id: 23, text: "您夜尿多吗？", textEn: "Do you have frequent nighttime urination?", category: "yang_deficiency" },
  // ===== D型：阴虚质 (8项) =====
  { id: 24, text: "您感到手脚心发热吗？", textEn: "Do your palms and soles feel hot?", category: "yin_deficiency" },
  { id: 25, text: "您感觉身体、脸上发热吗？", textEn: "Do you feel hot in your body or face?", category: "yin_deficiency" },
  { id: 26, text: "您皮肤或口唇干吗？", textEn: "Is your skin or lips dry?", category: "yin_deficiency" },
  { id: 27, text: "您感到口干咽燥、总想喝水吗？", textEn: "Do you have dry mouth and throat, always wanting to drink?", category: "yin_deficiency" },
  { id: 28, text: "您感到眼睛干涩吗？", textEn: "Do your eyes feel dry?", category: "yin_deficiency" },
  { id: 29, text: "您感到口苦或嘴里有异味吗？", textEn: "Do you have a bitter taste or bad breath?", category: "yin_deficiency" },
  { id: 30, text: "您大便干燥吗？", textEn: "Do you have dry stool?", category: "yin_deficiency" },
  { id: 31, text: "您小便量少色黄吗？", textEn: "Is your urine dark and scanty?", category: "yin_deficiency" },
  // ===== E型：痰湿质 (8项) =====
  { id: 32, text: "您感到胸闷或腹部胀满吗？", textEn: "Do you feel chest tightness or abdominal fullness?", category: "phlegm_damp" },
  { id: 33, text: "您感到身体沉重不轻松或不爽快吗？", textEn: "Does your body feel heavy and sluggish?", category: "phlegm_damp" },
  { id: 34, text: "您腹部肥满松软吗？", textEn: "Is your abdomen full, soft, and plump?", category: "phlegm_damp" },
  { id: 35, text: "您额头部位油脂分泌多吗？", textEn: "Does your forehead tend to be oily?", category: "phlegm_damp" },
  { id: 36, text: "您上眼睑比别人肿（有轻微隆起）吗？", textEn: "Are your upper eyelids puffier than others?", category: "phlegm_damp" },
  { id: 37, text: "您嘴里有黏黏的感觉吗？", textEn: "Does your mouth feel sticky?", category: "phlegm_damp" },
  { id: 38, text: "您平时痰多，特别是咽喉部总感到有痰堵着吗？", textEn: "Do you often have phlegm stuck in your throat?", category: "phlegm_damp" },
  { id: 39, text: "您舌苔厚腻或有舌苔厚腻的感觉吗？", textEn: "Do you have a thick, greasy tongue coating?", category: "phlegm_damp" },
  // ===== F型：湿热质 (6项) =====
  { id: 40, text: "您面部或鼻部有油腻感或者油亮发光吗？", textEn: "Does your face or nose feel oily or shiny?", category: "damp_heat" },
  { id: 41, text: "您容易长痤疮或疮疖吗？", textEn: "Are you prone to acne or boils?", category: "damp_heat" },
  { id: 42, text: "您感到口苦或嘴里有异味吗？", textEn: "Do you have a bitter taste or unusual odor in your mouth?", category: "damp_heat" },
  { id: 43, text: "您大便黏滞不爽、有解不尽的感觉吗？", textEn: "Is your stool sticky and hard to pass completely?", category: "damp_heat" },
  { id: 44, text: "您小便时尿道有发热感、尿色浓（深）吗？", textEn: "Does urination feel hot with dark urine?", category: "damp_heat" },
  { id: 45, text: "您带下色黄或阴囊潮湿不适吗？", textEn: "Do you have yellowish discharge or damp groin discomfort?", category: "damp_heat" },
  // ===== G型：血瘀质 (7项) =====
  { id: 46, text: "您皮肤常在不知不觉中出现青紫瘀斑吗？", textEn: "Do bruises appear on your skin without noticing?", category: "blood_stasis" },
  { id: 47, text: "您两颧部有细微红丝吗？", textEn: "Do you have fine red lines on your cheeks?", category: "blood_stasis" },
  { id: 48, text: "您身体上有哪里疼痛吗？", textEn: "Do you have pain anywhere in your body?", category: "blood_stasis" },
  { id: 49, text: "您面色晦暗或容易出现褐斑吗？", textEn: "Is your complexion dull or do you easily get brown spots?", category: "blood_stasis" },
  { id: 50, text: "您容易有黑眼圈吗？", textEn: "Do you easily get dark circles under your eyes?", category: "blood_stasis" },
  { id: 51, text: "您容易忘事（健忘）吗？", textEn: "Do you easily forget things?", category: "blood_stasis" },
  { id: 52, text: "您口唇颜色偏暗吗？", textEn: "Are your lips darker than normal?", category: "blood_stasis" },
  // ===== H型：气郁质 (7项) =====
  { id: 53, text: "您感到闷闷不乐、情绪低沉吗？", textEn: "Do you feel gloomy or down in mood?", category: "qi_stagnation" },
  { id: 54, text: "您容易精神紧张、焦虑不安吗？", textEn: "Do you easily feel nervous or anxious?", category: "qi_stagnation" },
  { id: 55, text: "您多愁善感、感情脆弱吗？", textEn: "Are you emotionally sensitive and fragile?", category: "qi_stagnation" },
  { id: 56, text: "您容易感到害怕或受到惊吓吗？", textEn: "Do you easily feel scared or startled?", category: "qi_stagnation" },
  { id: 57, text: "您胁肋部或乳房胀痛吗？", textEn: "Do you have pain or fullness in your ribs or breasts?", category: "qi_stagnation" },
  { id: 58, text: "您有无缘无故叹气（唉声叹气）吗？", textEn: "Do you find yourself sighing for no reason?", category: "qi_stagnation" },
  { id: 59, text: "您咽喉部有异物感（咽之不下、吐之不出）吗？", textEn: "Do you feel something stuck in your throat?", category: "qi_stagnation" },
  // ===== I型：特禀质 (7项) =====
  { id: 60, text: "您没有感冒也会打喷嚏吗？", textEn: "Do you sneeze even without a cold?", category: "special" },
  { id: 61, text: "您没有感冒也会鼻塞、流鼻涕吗？", textEn: "Do you have a stuffy or runny nose without a cold?", category: "special" },
  { id: 62, text: "您有因季节变化、温度变化或异味等原因引起的咳喘吗？", textEn: "Do you cough or wheeze from season changes or odors?", category: "special" },
  { id: 63, text: "您容易过敏（对药物、食物、气味、花粉或季节交替时）吗？", textEn: "Are you prone to allergies (drugs, foods, pollen, seasons)?", category: "special" },
  { id: 64, text: "您皮肤容易起荨麻疹（风团、风疹块）吗？", textEn: "Does your skin easily break out in hives?", category: "special" },
  { id: 65, text: "您皮肤因过敏出现过紫癜（紫红色瘀点、瘀斑）吗？", textEn: "Have you ever had allergic purpura (purple spots)?", category: "special" },
  { id: 66, text: "您的皮肤一抓就红，并出现抓痕吗？", textEn: "Does your skin turn red and show scratch marks after scratching?", category: "special" },
];

// ==================== 评分选项 ====================

const optionLabels = {
  zh: ["没有", "很少", "有时", "经常", "总是"],
  en: ["Never", "Rarely", "Sometimes", "Often", "Always"],
};

// ==================== 标准评分算法 ====================

type JudgmentLevel = "是" | "基本是" | "倾向是" | "否";

/** 转化分 = (原始分 - 条目数) / (条目数 × 4) × 100 */
function getTransformedScore(rawScore: number, itemCount: number): number {
  if (itemCount === 0) return 0;
  return ((rawScore - itemCount) / (itemCount * 4)) * 100;
}

/** 平和质判断：需结合所有偏颇体质得分 */
function getNeutralJudgment(neutralScore: number, biasedScores: number[]): JudgmentLevel {
  if (neutralScore >= 60) {
    if (biasedScores.every((s) => s < 30)) return "是";
    if (biasedScores.every((s) => s < 40)) return "基本是";
  }
  return "否";
}

/** 偏颇体质判断 */
function getBiasedJudgment(score: number): JudgmentLevel {
  if (score >= 40) return "是";
  if (score >= 30) return "倾向是";
  return "否";
}

/** 判断等级对应的显示样式 */
function getJudgmentStyle(level: JudgmentLevel, isNeutral: boolean) {
  if (isNeutral) {
    switch (level) {
      case "是": return "bg-green-100 text-green-800 border-green-300";
      case "基本是": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-500 border-gray-200";
    }
  }
  switch (level) {
    case "是": return "bg-orange-100 text-orange-800 border-orange-300";
    case "倾向是": return "bg-amber-100 text-amber-700 border-amber-300";
    default: return "bg-gray-100 text-gray-400 border-gray-200";
  }
}

// ==================== 温度缩放校准置信度 ====================
// 说明：ZYYXH/T157-2009 的核心仍然是“原始分→转化分→阈值判定”。
// 置信度迁移 Guo et al. ICML 2017 提出的 temperature scaling 思想：
// 将各体质距标准阈值的证据转成 calibrated probability，并结合熵、决策边界、完成率和答题质量，
// 避免把量表分数或 Cronbach α 这类群体信度指标误当成单次个人医学诊断准确率。

/** 置信度等级对应样式 */
function getConfidenceStyle(level: string) {
  switch (level) {
    case "高": return "text-green-700 bg-green-50";
    case "中": return "text-blue-700 bg-blue-50";
    case "较低": return "text-amber-700 bg-amber-50";
    default: return "text-red-700 bg-red-50";
  }
}

// ==================== 主组件 ====================

export default function TCMConstitution() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const isZh = language === "zh";
  const navigate = useNavigate();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  const handleAnswer = (questionId: number, score: number) => {
    const newAnswers = { ...answers, [questionId]: score };
    setAnswers(newAnswers);

    const currentIndex = questions.findIndex((q) => q.id === questionId);
    const nextUnanswered = questions.slice(currentIndex + 1).find((q) => !(q.id in newAnswers));
    if (nextUnanswered) {
      setCurrentQuestion(questions.indexOf(nextUnanswered));
    } else if (Object.keys(newAnswers).length === totalQuestions) {
      setShowResult(true);
    } else {
      const remaining = questions.find((q) => !(q.id in newAnswers));
      if (remaining) {
        setCurrentQuestion(questions.indexOf(remaining));
      }
    }
  };

  const calculateResults = () => {
    // 步骤1：计算各子量表原始分（含反向计分）
    const rawScores: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const type of constitutionTypes) {
      rawScores[type.id] = 0;
      counts[type.id] = 0;
    }

    for (const q of questions) {
      if (answers[q.id] !== undefined) {
        // 平和质反向计分条目：score = 6 - rawScore
        const score = q.reverse ? (6 - answers[q.id]) : answers[q.id];
        rawScores[q.category] = (rawScores[q.category] || 0) + score;
        counts[q.category] = (counts[q.category] || 0) + 1;
      }
    }

    // 步骤2：计算转化分
    const transformedScores: Record<string, number> = {};
    const results = constitutionTypes.map((type) => {
      const count = counts[type.id] || 0;
      const raw = rawScores[type.id] || 0;
      const transformed = getTransformedScore(raw, count);
      transformedScores[type.id] = transformed;
      return { type, rawScore: raw, itemCount: count, transformedScore: transformed };
    });

    // 步骤3：确定判断等级
    const biasedScores = Object.entries(transformedScores)
      .filter(([id]) => id !== "neutral")
      .map(([, score]) => score);

    const enrichedResults = results.map((r) => {
      const judgment: JudgmentLevel = r.type.id === "neutral"
        ? getNeutralJudgment(r.transformedScore, biasedScores)
        : getBiasedJudgment(r.transformedScore);
      return { ...r, judgment };
    });

    // 按转化分降序排列
    enrichedResults.sort((a, b) => b.transformedScore - a.transformedScore);
    return enrichedResults;
  };

  const reset = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setShowResult(false);
  };

  // ==================== 未登录状态 ====================

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="p-12 text-center bg-gradient-to-br from-[#F5F0E8] to-[#E8F0EA] rounded-3xl border-0">
          <Lock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-2">
            {isZh ? "登录后进行体质辨识" : "Sign in for Constitution Assessment"}
          </h2>
          <p className="text-gray-600 mb-6">
            {isZh
              ? "基于中华中医药学会标准，通过66项专业量表评估您的体质类型"
              : "Based on CACM standard, assess your constitution with a 66-item professional scale"}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/login")}>{isZh ? "立即登录" : "Sign In"}</Button>
            <Button onClick={() => navigate("/register")} variant="outline">{isZh ? "注册账号" : "Register"}</Button>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {constitutionTypes.map((type) => (
            <Card key={type.id} className="p-4 text-center opacity-60">
              <div className="text-2xl mb-1">{type.icon}</div>
              <p className="font-medium text-sm">{isZh ? type.name : type.nameEn}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ==================== 结果展示 ====================

  if (showResult) {
    const results = calculateResults();
    const neutralResult = results.find((r) => r.type.id === "neutral")!;
    const biasedResults = results.filter((r) => r.type.id !== "neutral");
    const positiveBiasedResults = biasedResults
      .filter((r) => r.judgment !== "否")
      .sort((a, b) => b.transformedScore - a.transformedScore);

    // 主体质按 ZYYXH/T157-2009 判定逻辑选择：
    // 1) 平和质“是/基本是”时优先判为平和；
    // 2) 否则在偏颇体质中选择转化分最高且达到“是/倾向是”的类型；
    // 3) 若没有任何类型达阈值，则取分值最高者作为低可信倾向提示。
    const isNeutralPrimary = neutralResult.judgment === "是" || neutralResult.judgment === "基本是";
    const primary = isNeutralPrimary
      ? neutralResult
      : (positiveBiasedResults[0] || biasedResults[0] || neutralResult);
    const confidence = calculateCalibratedConstitutionConfidence(results, primary, answeredCount, totalQuestions, answers);

    // 兼夹体质：转化分 ≥ 30 的偏颇体质（排除主体质）
    const mixedTypes = positiveBiasedResults.filter((r) => r.type.id !== primary.type.id);

    // 生成总结语
    const getSummary = () => {
      if (isNeutralPrimary) {
        return isZh
          ? (primary.judgment === "是"
            ? "根据标准判定，您的体质属于平和质。阴阳气血调和，是理想的健康体质状态。"
            : "根据标准判定，您的体质基本属于平和质。整体状态良好，继续保持健康的生活方式。")
          : (primary.judgment === "是"
            ? "Based on the standard criteria, your constitution is Neutral (Ping He). Yin-yang and qi-blood are balanced."
            : "Your constitution is mostly Neutral. Overall in good condition, keep up the healthy lifestyle.");
      }
      const primaryName = isZh ? primary.type.name : primary.type.nameEn;
      const levelText = primary.judgment === "是" ? "" : isZh ? "（倾向）" : " (tendency)";
      const mixedNames = mixedTypes.map((r) => isZh ? r.type.name : r.type.nameEn).join("、");
      if (mixedNames) {
        return isZh
          ? `根据标准判定，您的体质偏于${primaryName}${levelText}，兼夹${mixedNames}。`
          : `Your constitution leans toward ${primaryName}${levelText}, with mixed ${mixedNames} tendencies.`;
      }
      return isZh
        ? `根据标准判定，您的体质偏于${primaryName}${levelText}。`
        : `Your constitution leans toward ${primaryName}${levelText}.`;
    };

    // AI 综合健康建议生成
    if (!aiAdvice && !aiLoading) {
      const adviceData = {
        primary: isZh ? primary.type.name : primary.type.nameEn,
        primaryScore: primary.transformedScore.toFixed(1),
        primaryJudgment: primary.judgment,
        mixed: mixedTypes.map(r => `${isZh ? r.type.name : r.type.nameEn}(${r.transformedScore.toFixed(1)}分,${r.judgment})`).join("、") || "无",
        confidence: `${confidence.score}分(${confidence.level})`,
        allScores: results.map(r => `${isZh ? r.type.name : r.type.nameEn}:${r.transformedScore.toFixed(1)}`).join("，"),
      };
      const userMsg = isZh
        ? `我刚完成中医体质辨识量表（ZYYXH/T157-2009），请根据以下结果生成个性化综合健康建议。\n\n主体质：${adviceData.primary}（转化分${adviceData.primaryScore}，判定"${adviceData.primaryJudgment}"）\n兼夹体质：${adviceData.mixed}\n评估置信度：${adviceData.confidence}\n九种体质得分：${adviceData.allScores}\n\n请从以下方面给出具体、实用的建议：\n1. 体质特征解读（通俗易懂）\n2. 饮食调养（宜吃/忌吃的具体食物）\n3. 运动建议（推荐运动类型和注意事项）\n4. 起居调摄（作息、季节养生要点）\n5. 情志调节（心理调适方法）\n6. 穴位保健（推荐2-3个穴位及按揉方法）\n\n用Markdown格式输出，语言通俗、实用。`
        : `I completed the TCM constitution assessment (ZYYXH/T157-2009). Primary: ${adviceData.primary} (score ${adviceData.primaryScore}, "${adviceData.primaryJudgment}"). Mixed: ${adviceData.mixed}. Confidence: ${adviceData.confidence}. Scores: ${adviceData.allScores}. Please generate personalized health advice covering: constitution interpretation, diet, exercise, lifestyle, emotional wellness, and acupressure. Use Markdown.`;

      setAiLoading(true);
      fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: userMsg }),
      })
        .then(res => res.json())
        .then(data => {
          const text = data.response || data.data?.response || data.content || data.data?.content || (typeof data === "string" ? data : null);
          setAiAdvice(text || (isZh ? "AI 建议生成失败，请参考上方静态建议。" : "AI advice generation failed."));
        })
        .catch(() => setAiAdvice(null))
        .finally(() => setAiLoading(false));
    }

    return (
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-[#5B7D63]" />
            {isZh ? "体质辨识结果" : "Assessment Results"}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {isZh ? "基于ZYYXH/T157-2009标准" : "Based on ZYYXH/T157-2009"}
            </span>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {isZh ? "重新测评" : "Retake"}
            </Button>
          </div>
        </div>

        {/* 综合判断结论 */}
        <div className={`p-5 rounded-xl border-2 ${primary.type.color}`}>
          <p className="text-base leading-relaxed font-medium">{getSummary()}</p>
        </div>

        {/* 评估置信度 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#2D3B2E]">{isZh ? "评估置信度" : "Assessment Confidence"}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getConfidenceStyle(confidence.level)}`}>
              {confidence.score}% · {isZh ? `${confidence.level}置信度` : `${confidence.level} Confidence`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all ${confidence.score >= 80 ? "bg-green-500" : confidence.score >= 60 ? "bg-blue-500" : confidence.score >= 40 ? "bg-amber-500" : "bg-red-400"}`}
              style={{ width: `${confidence.score}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs text-[#6B7B6E]">
            <div className="text-center">
              <p className="font-medium text-[#2D3B2E]">{confidence.breakdown.calibratedProbability}%</p>
              <p>{isZh ? "校准概率" : "Calibrated"}</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3B2E]">{confidence.breakdown.entropyCertainty}%</p>
              <p>{isZh ? "分布确定" : "Entropy"}</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3B2E]">{confidence.breakdown.decisionMargin}%</p>
              <p>{isZh ? "决策边界" : "Margin"}</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3B2E]">{confidence.breakdown.responseQuality}%</p>
              <p>{isZh ? "答题质量" : "Response"}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isZh
              ? "可信度不等同于医学诊断准确率；它采用温度缩放校准概率，并结合结果分布熵、距标准判定边界的稳定性、完成率和是否存在单一化答题来提示本次量表结果稳定性。"
              : "Confidence is not diagnostic accuracy; it uses temperature-scaled calibrated probability plus entropy, decision-boundary stability, completion, and response quality."}
          </p>
        </Card>

        {/* 主体质详情 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{isZh ? "主体质判定" : "Primary Constitution"}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getJudgmentStyle(primary.judgment, primary.type.id === "neutral")}`}>
              {primary.judgment}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{primary.type.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xl font-bold">{isZh ? primary.type.name : primary.type.nameEn}</h4>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{isZh ? primary.type.description : primary.type.descriptionEn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">{isZh ? "转化分" : "Score"}</span>
            <div className="flex-1">
              <Progress value={Math.min(100, Math.max(0, primary.transformedScore))} className="h-2.5" />
            </div>
            <span className="text-sm font-bold">{primary.transformedScore.toFixed(1)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 text-sm">{isZh ? "主要特征" : "Key Features"}</h4>
              <ul className="space-y-1">
                {(isZh ? primary.type.features : primary.type.featuresEn).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#5B7D63]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-sm">{isZh ? "调养建议" : "Health Advice"}</h4>
              <p className="text-sm leading-relaxed">{isZh ? primary.type.advice : primary.type.adviceEn}</p>
            </div>
          </div>
        </Card>

        {/* 九种体质转化分全览 */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-1">{isZh ? "九种体质转化分" : "All Constitution Scores"}</h3>
          <p className="text-xs text-gray-400 mb-4">
            {isZh
              ? "转化分 = (原始分 - 条目数) / (条目数 × 4) × 100 | ≥40为「是」 30~39为「倾向是」 <30为「否」"
              : "Transformed Score = (Raw - Items) / (Items × 4) × 100 | ≥40=Yes 30~39=Tendency <30=No"}
          </p>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.type.id} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{r.type.icon}</span>
                <span className="w-16 text-sm font-medium shrink-0">{isZh ? r.type.name : r.type.nameEn}</span>
                <div className="flex-1">
                  <Progress value={Math.min(100, Math.max(0, r.transformedScore))} className="h-2" />
                </div>
                <span className="text-sm font-mono w-10 text-right">{r.transformedScore.toFixed(1)}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${getJudgmentStyle(r.judgment, r.type.id === "neutral")}`}>
                  {r.judgment}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* 平和质判定详情 */}
        {neutralResult.judgment !== "是" && (
          <Card className="p-5 border-l-4 border-l-blue-400">
            <h4 className="font-medium text-sm mb-2">{isZh ? "平和质判定标准" : "Neutral Constitution Criteria"}</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                {isZh
                  ? `平和质转化分：${neutralResult.transformedScore.toFixed(1)}（需 ≥ 60）`
                  : `Neutral score: ${neutralResult.transformedScore.toFixed(1)} (requires ≥ 60)`}
              </p>
              <p>
                {isZh
                  ? `偏颇体质最高转化分：${biasedResults[0]?.transformedScore.toFixed(1) || "—"}（需全部 < 30 为「是」，< 40 为「基本是」）`
                  : `Highest biased score: ${biasedResults[0]?.transformedScore.toFixed(1) || "—"} (all < 30 for Yes, < 40 for Mostly)`}
              </p>
            </div>
          </Card>
        )}

        {/* 兼夹体质 */}
        {mixedTypes.length > 0 && (
          <Card className="p-5 border-l-4 border-l-amber-500">
            <h4 className="font-medium text-sm mb-3">{isZh ? "兼夹体质" : "Mixed Constitution Types"}</h4>
            <div className="space-y-2">
              {mixedTypes.map((r) => (
                <div key={r.type.id} className="flex items-center gap-3">
                  <span>{r.type.icon}</span>
                  <span className="font-medium text-sm">{isZh ? r.type.name : r.type.nameEn}</span>
                  <span className="text-xs text-gray-500">
                    {isZh ? "转化分" : "Score"} {r.transformedScore.toFixed(1)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getJudgmentStyle(r.judgment, false)}`}>
                    {r.judgment}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* AI 综合健康建议 */}
        <Card className="p-6 border-[#C8D9CA]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-[#5B7D63]">✦</span>
            {isZh ? "AI 综合健康建议" : "AI Comprehensive Health Advice"}
          </h3>
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="animate-spin h-8 w-8 border-2 border-[#7C9A82] border-t-transparent rounded-full" />
              <p className="text-sm text-[#6B7B6E]">{isZh ? "正在生成个性化健康建议..." : "Generating personalized health advice..."}</p>
            </div>
          ) : aiAdvice ? (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {aiAdvice.split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <br key={i} />;
                if (/^#{1,3}\s/.test(trimmed)) {
                  const level = trimmed.match(/^(#{1,3})\s/)?.[1]?.length || 2;
                  const text = trimmed.replace(/^#{1,3}\s/, "");
                  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
                  const cls = level === 1 ? "text-lg font-bold text-[#2D3B2E] mt-4 mb-2" : level === 2 ? "text-base font-semibold text-[#3D5B45] mt-3 mb-1.5" : "text-sm font-semibold text-[#5B7D63] mt-2 mb-1";
                  return <Tag key={i} className={cls}>{text}</Tag>;
                }
                if (/^[-*]\s/.test(trimmed)) {
                  return <li key={i} className="text-sm ml-4">{trimmed.replace(/^[-*]\s/, "")}</li>;
                }
                if (/^\d+\.\s/.test(trimmed)) {
                  return <li key={i} className="text-sm ml-4 list-decimal">{trimmed.replace(/^\d+\.\s/, "")}</li>;
                }
                if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                  return <p key={i} className="text-sm font-semibold text-[#3D5B45]">{trimmed.replace(/\*\*/g, "")}</p>;
                }
                return <p key={i} className="text-sm">{trimmed}</p>;
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">{isZh ? primary.type.name : primary.type.nameEn}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{isZh ? primary.type.advice : primary.type.adviceEn}</p>
              </div>
              {mixedTypes.map((r) => (
                <div key={r.type.id}>
                  <h4 className="font-medium text-sm mb-1">{isZh ? r.type.name : r.type.nameEn}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{isZh ? r.type.advice : r.type.adviceEn}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 免责声明 */}
        <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-800 border border-amber-200 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {isZh
              ? "以上结果基于中华中医药学会《中医体质分类与判定》(ZYYXH/T157-2009) 标准量表计算，仅供参考，不能替代专业中医师的四诊合参诊断。如需进一步了解，建议前往正规中医机构面诊。"
              : "Results are based on CACM standard ZYYXH/T157-2009 and are for reference only. They cannot replace professional TCM diagnosis. Please consult a qualified TCM practitioner."}
          </span>
        </div>
      </div>
    );
  }

  // ==================== 答题界面 ====================

  const question = questions[currentQuestion];

  // 判断当前题目所属体质类型名称
  const categoryType = constitutionTypes.find((t) => t.id === question.category);
  const categoryName = categoryType ? (isZh ? categoryType.name : categoryType.nameEn) : "";

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-[#5B7D63]" />
          {isZh ? "中医体质辨识" : "TCM Constitution Assessment"}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {isZh ? "ZYYXH/T157-2009" : "Standard"}
          </span>
          <span className="text-sm text-gray-500">
            {answeredCount}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{categoryName}</span>
          <span className="text-xs text-gray-400">{progress.toFixed(0)}%</span>
        </div>
      </div>

      {/* 题目卡片 */}
      <Card className="p-6">
        <div className="mb-6">
          <span className="text-sm text-gray-400">Q{currentQuestion + 1}</span>
          <h3 className="text-lg font-medium mt-1">{isZh ? question.text : question.textEn}</h3>
        </div>

        <div className="space-y-2">
          {(isZh ? optionLabels.zh : optionLabels.en).map((label, score) => (
            <button
              key={score}
              onClick={() => handleAnswer(question.id, score + 1)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                answers[question.id] === score + 1
                  ? "border-[#5B7D63] bg-[#E8F0EA] text-[#3D5A45] font-medium"
                  : "border-gray-200 hover:border-[#7C9A82]/40 hover:bg-[#E8F0EA]/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs ${
                  answers[question.id] === score + 1
                    ? "border-[#5B7D63] bg-[#7C9A82] text-white"
                    : "border-gray-300"
                }`}>
                  {answers[question.id] === score + 1 && "✓"}
                </div>
                <span>{label}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* 导航 */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {isZh ? "上一题" : "Previous"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {isZh ? "重新开始" : "Restart"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQuestion(Math.min(totalQuestions - 1, currentQuestion + 1))}
          disabled={currentQuestion === totalQuestions - 1}
        >
          {isZh ? "下一题" : "Next"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* 提前查看结果 */}
      {answeredCount >= 50 && answeredCount < totalQuestions && (
        <div className="text-center">
          <Button onClick={() => setShowResult(true)} className="bg-[#7C9A82] hover:bg-[#5B7D63]">
            {isZh
              ? `提前查看结果（已完成 ${answeredCount}/${totalQuestions} 题，结果可能不够准确）`
              : `View Results Early (${answeredCount}/${totalQuestions} answered, may be less accurate)`}
          </Button>
        </div>
      )}
    </div>
  );
}
