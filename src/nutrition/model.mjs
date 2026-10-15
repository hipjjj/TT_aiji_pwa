import {recordLimits} from '../recordLimits.mjs';
import rawFoods from './foods.json' with { type:'json' };
import fistReferences from './hand-portions.json' with { type:'json' };
import aiHandData from './ai-hand-portions.json' with {type:'json'};
import aiFoods from './ai-food-estimates.json' with {type:'json'};
export const handPortionReferences=fistReferences;
export const aiHandPortionReferences=aiHandData.entries;
export const foodLibrary = [...rawFoods,...aiFoods];
export const fistPortionLibrary=foodLibrary.flatMap(food=>{const ref=fistReferences[food.id],ai=aiHandData.entries[food.id];return ref?[{foodId:food.id,name:food.name,grams:ref.gramsPerFist,min:ref.gramsPerFist,max:ref.gramsPerFist,basis:'USDA杯重参考'}]:ai?[{foodId:food.id,name:food.name,grams:ai.gramsPerFist,min:ai.minGrams,max:ai.maxGrams,basis:'AI粗估'}]:[];});
export function fistPortion(food,amount){
 if(food.id.startsWith('personal-food-')){
  const grams=food.portions['拳'];if(!grams||!Number.isFinite(amount)||amount<=0||grams*amount>10000)return null;
  return makePortion(food,round(grams*amount,2),`按我的食物库已确认的1拳约${grams}克换算，${amount}拳约${round(grams*amount,2)}克；${food.note}。请核对实际份量及做法。`);
 }
 const ref=fistReferences[food.id],ai=aiHandData.entries[food.id];
 if(!ref&&ai){
  if(!Number.isFinite(amount)||amount<=0||amount*ai.gramsPerFist>10000)return null;
  const portion=makePortion(food,round(amount*ai.gramsPerFist,2),`拳头份量为AI粗估，非实测：1拳约${ai.gramsPerFist}克，可能约${ai.minGrams}–${ai.maxGrams}克；${amount}拳按${round(amount*ai.gramsPerFist,2)}克计算。假设：${ai.assumption}。手大小和压实程度会改变重量，请核对克数。${food.kind==='recipe'?'营养沿用所列参考配方（含配方中的油），不是这道菜的实测值；实际用油和配菜不同时请修改。':'未计额外烹调油。'}${food.estimated?'该条目营养也含AI参考估算，请核对。':''}`);
  return {...portion,sourceLabel:portion.sourceLabel+' · 拳头份量为AI粗估',confidence:'low'};
 }
 if(!ref||!Number.isFinite(amount)||amount<=0||amount*ref.gramsPerFist>10000)return null;
 return makePortion(food,round(amount*ref.gramsPerFist,2),`拳头体积粗估：采用1拳≈1杯的参考体积，${amount}拳约${round(amount*ref.gramsPerFist,2)}克；该食物USDA SR28 ${ref.sourceId} 的${ref.cupDescription}每杯约${ref.gramsPerFist}克。手大小、切法、生熟和压实程度会改变重量，请核对克数；烹调油需另计。`);
}
import { validDate } from '../model.mjs';
export const mealTypes = ['早餐','午餐','晚餐','加餐'];
export const nutrientKeys = ['kcal','protein','carbs','fat'];
const nutrientNames={kcal:'热量',protein:'蛋白质',carbs:'碳水化合物',fat:'脂肪'};
export const activityFactors = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,'very-active':1.9};
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function dayBefore(date,days) { const [y,m,d]=date.split('-').map(Number);return localDate(new Date(y,m-1,d-days)); }
export function round(value,places=1) { const factor=10**places;return Math.round((value+Number.EPSILON*Math.max(1,Math.abs(value))*8)*factor)/factor; }
export function sumNutrition(items) {
  const result={kcal:0,protein:0,carbs:0,fat:0};
  for(const item of items) for(const key of nutrientKeys) result[key]+=item.per100[key]*item.grams/100;
  return Object.fromEntries(nutrientKeys.map(key=>[key,round(result[key])]));
}
export function rangeStatus(value,range) {
  if(!range) return '未设目标';
  return value<range.min?'低于目标':value>range.max?'超出目标':'目标内';
}
function number(value,min,max,label) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max) throw new Error(`${label}无效`);
  return value;
}
export function validateTargets(targets) {
  if(!targets||typeof targets!=='object')throw new Error('营养目标格式无效');
  const limits={kcal:[1200,10000],protein:[0,500],carbs:[0,1500],fat:[0,500]};
  return Object.fromEntries(nutrientKeys.map(key=>{
    const range=targets[key];if(!range||typeof range!=='object')throw new Error('营养目标格式无效');
    const min=number(range.min,...limits[key],`${nutrientNames[key]}目标下限`),max=number(range.max,...limits[key],`${nutrientNames[key]}目标上限`);
    if(min>max)throw new Error('目标下限不能高于上限');return [key,{min,max}];
  }));
}
export function validateBody(body) {
  if(!body||!['male','female'].includes(body.sex)||!Object.hasOwn(activityFactors,body.activity)||!['lose','maintain','gain'].includes(body.goal))throw new Error('请完整填写用于目标计算的资料');
  if(!Number.isInteger(body.age))throw new Error('年龄请填写整数');
  return {sex:body.sex,age:number(body.age,18,100,'年龄（本版面向18–100岁成年人）'),heightCm:number(body.heightCm,120,230,'身高'),weightKg:number(body.weightKg,35,250,'体重'),activity:body.activity,goal:body.goal};
}
export function calculateTargets(input) {
  const body=validateBody(input);const bmi=body.weightKg/(body.heightCm/100)**2;
  if(body.goal==='lose'&&bmi<18.5)throw new Error('当前身高体重不适合通用减脂估算，请选择维持或使用专业建议设置目标');
  const bmr=10*body.weightKg+6.25*body.heightCm-5*body.age+(body.sex==='male'?5:-161);
  const floor=body.sex==='male'?1500:1200;
  const calories=Math.round(Math.max(floor,bmr*activityFactors[body.activity]*(body.goal==='lose'?.85:body.goal==='gain'?1.1:1))/10)*10;
  const protein=round(body.weightKg*(body.goal==='maintain'?1.2:1.6));
  const fat=round(calories*.25/9);const carbs=round(Math.max(0,(calories-protein*4-fat*9)/4));
  const targets={};
  for(const [key,value] of Object.entries({kcal:calories,protein,carbs,fat})) targets[key]={min:key==='kcal'?Math.max(floor,Math.round(value*.9)):round(value*.9),max:key==='kcal'?Math.round(value*1.1):round(value*1.1)};
  return {targets:validateTargets(targets),bmr:Math.round(bmr),maintenance:Math.round(bmr*activityFactors[body.activity]),bmi:round(bmi)};
}
export function validateProfile(input) {
  if(!input||input.id!=='main'||!['auto','manual'].includes(input.mode))throw new Error('营养目标资料无效');
  return {id:'main',mode:input.mode,body:input.mode==='auto'?validateBody(input.body):null,targets:validateTargets(input.targets),updatedAt:number(input.updatedAt,0,Number.MAX_SAFE_INTEGER,'目标更新时间')};
}
const normalize = text => text.normalize('NFKC').trim().toLowerCase().replace(/[\s（）()]/g,'');
export function findFood(name,personalFoods=[]) {const n=normalize(name);return [...personalFoods,...foodLibrary].find(food=>[food.name,...food.aliases].some(alias=>normalize(alias)===n));}
export function searchFoods(query,group='全部',personalFoods=[]) {
  const n=normalize(query);
  return [...personalFoods,...foodLibrary].filter(food=>(group==='全部'||food.group===group)&&(!n||[food.name,...food.aliases].some(alias=>normalize(alias).includes(n))));
}
export function makePortion(food,grams=food.defaultGrams,assumption='') {
  return {id:crypto.randomUUID(),foodId:food.id,name:food.name,grams,per100:{...food.per100},source:'dictionary',sourceLabel:`${food.reference} · ${food.sourceId}`,assumption:assumption||`${food.defaultUnit}份量仅为参考；${food.note}`};
}
function quantity(text) {
  if(text==='半')return .5;if(/^\d/.test(text))return Number(text);
  const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};let result=0,current=0;
  for(const char of text){if(digits[char])current=digits[char];else if(char==='十'||char==='百'){result+=(current||1)*(char==='十'?10:100);current=0;}else return NaN;}return result+current;
}
export function parseMealText(text,personalFoods=[]) {
  if(typeof text!=='string'||text.length>2000)throw new Error('文字描述不能超过2000字');
  const normalized=text.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10));
  const fragments=normalized.split(/[，,、；;+＋\n]+/).map(s=>s.trim()).filter(Boolean);
  if(fragments.length>20)throw new Error('一餐最多记录20种食物');
  const n='(\\d+(?:\\.\\d+)?|半|[一二两三四五六七八九十百]+)',u='(公斤|千克|kg|毫升|ml|克|g|斤|两|碗|个拳头|个拳|个|根|片|杯|份|勺|把|盒|盘|条|拳头|拳)';
  const before=new RegExp(`^${n}\\s*${u}\\s*(.+)$`,'i'),after=new RegExp(`^(.+?)\\s*${n}\\s*${u}$`,'i');
  const items=[],unresolved=[];
  for(const fragment of fragments){
    let name=fragment.replace(/^(?:早餐|午餐|晚餐|加餐)?[：:]?(?:吃了|吃的)?/,'').trim(),amount=null,unit=null;
    const prefix=name.match(before),suffix=name.match(after);
    if(prefix){amount=quantity(prefix[1]);unit=prefix[2].toLowerCase();name=prefix[3].trim().replace(/^的/,'');}
    else if(suffix){name=suffix[1].trim();amount=quantity(suffix[2]);unit=suffix[3].toLowerCase();}
    const food=findFood(name,personalFoods);
    if(unit&&unit.includes('拳')){const portion=food?fistPortion(food,amount):null;if(portion){items.push(portion);}else{unresolved.push({text:fragment,reason:'“拳”没有固定克重，这项食物暂缺对应的一杯参考重量或份量超出范围。请补充克数，或点击“小包帮你问问AI”估算后核对食物、份量和用油。'});}continue;}
    if(!food){unresolved.push({text:fragment,reason:'食物库暂未匹配，请选择食物或手动补充；也可以主动问AI。'});continue;}
    let grams=food.defaultGrams,assumption=`未提供克数，按1${food.defaultUnit}约${grams}克估计；请核对。`;
    if(amount!==null){
      if(['克','g'].includes(unit)){grams=amount;assumption='按输入克数计算，请核对食物的生熟状态。';}
      else if(['公斤','千克','kg'].includes(unit)){grams=amount*1000;assumption='已换算为克，请核对生熟状态。';}
      else if(unit==='斤'||unit==='两'){grams=amount*(unit==='斤'?500:50);assumption='按市制重量换算为克。';}
      else if(['毫升','ml'].includes(unit)&&['milk','low-fat-milk','soymilk','water','coffee','banana-milk'].includes(food.id)){grams=amount;assumption='毫升按约1毫升=1克换算，实际密度可能不同，请核对。';}
      else if(Object.hasOwn(food.portions,unit)){grams=amount*food.portions[unit];assumption=`按${amount}${unit}约${round(grams)}克估计，请按实际份量修改。`;}
      else {unresolved.push({text:fragment,reason:'这个份量单位尚无对应重量，请改用克数或从食物库选择。'});continue;}
    }
    if(!Number.isFinite(grams)||grams<=0||grams>10000){unresolved.push({text:fragment,reason:'份量须大于0且不超过10000克。'});continue;}
    items.push(makePortion(food,round(grams,2),`${assumption} ${food.kind==='recipe'||food.id.startsWith('personal-food-')?food.note:''}`.trim()));
  }
  return {items,unresolved};
}
export function validateNutrients(input) {
  if(!input||typeof input!=='object')throw new Error('食物营养数据无效');
  const values=Object.fromEntries(nutrientKeys.map(key=>[key,number(input[key],0,key==='kcal'?1000:100,`每100克${nutrientNames[key]}`)]));
  if(values.protein+values.carbs+values.fat>105)throw new Error('每100克食物的三大营养素合计不合理，请核对');
  return values;
}
export function validatePortion(item) {
  if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||typeof item.name!=='string'||!item.name.trim()||item.name.length>100||!['dictionary','ai','manual'].includes(item.source)||typeof item.sourceLabel!=='string'||item.sourceLabel.length>200||typeof item.assumption!=='string'||item.assumption.length>1000)throw new Error('饮食记录中的食物格式无效');
  const foodId=typeof item.foodId==='string'&&item.foodId.length<=100?item.foodId:undefined;
  if(item.confidence!==undefined&&!['high','medium','low'].includes(item.confidence))throw new Error('AI可信度标记无效');
  return {id:item.id,...(foodId?{foodId}:{}),name:item.name.trim(),grams:number(item.grams,.01,10000,'食物份量'),per100:validateNutrients(item.per100),source:item.source,sourceLabel:item.sourceLabel,assumption:item.assumption,...(item.confidence?{confidence:item.confidence}:{})};
}
export function validatePhoto(photo) {
  if(photo===null||photo===undefined)return null;
  if(typeof photo!=='string'||photo.length>650000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw new Error('饮食照片格式或大小无效');
  const head=atob(photo.split(',')[1].slice(0,32));
  if(photo.startsWith('data:image/jpeg')&&!head.startsWith('\xff\xd8\xff')||photo.startsWith('data:image/png')&&!head.startsWith('\x89PNG\r\n\x1a\n')||photo.startsWith('data:image/webp')&&!(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'))throw new Error('饮食照片内容无效');
  return photo;
}
export function validateMeal(input) {
  if(!input||typeof input.id!=='string'||!input.id||input.id.length>100||!validDate(input.date)||!mealTypes.includes(input.mealType)||!Array.isArray(input.items)||input.items.length<1||input.items.length>20||typeof input.note!=='string'||input.note.length>recordLimits.note)throw new Error('饮食记录格式无效');
  const ids=new Set();const items=input.items.map(item=>{const validated=validatePortion(item);if(ids.has(validated.id))throw new Error('饮食记录含重复食物编号');ids.add(validated.id);return validated;});
  if(input.expenseId!==null&&input.expenseId!==undefined&&(typeof input.expenseId!=='string'||!input.expenseId||input.expenseId.length>100))throw new Error('饮食记录关联的账单编号无效');
  return {id:input.id,date:input.date,mealType:input.mealType,items,note:input.note,photo:validatePhoto(input.photo),expenseId:input.expenseId||null,updatedAt:number(input.updatedAt,0,Number.MAX_SAFE_INTEGER,'饮食更新时间')};
}
export function validateNutritionBackup(data) {
  if(data.nutrition===undefined)return null;
  const value=data.nutrition;
  if(!value||!Array.isArray(value.meals)||value.meals.length>10000||!Object.hasOwn(value,'profile'))throw new Error('营养备份格式无效');
  if(value.photosIncluded!==undefined&&typeof value.photosIncluded!=='boolean')throw new Error('营养备份照片标记无效');
  const ids=new Set(),expenseIds=new Set();
  const meals=value.meals.map(input=>{const meal=validateMeal(input);if(ids.has(meal.id)||meal.expenseId&&expenseIds.has(meal.expenseId))throw new Error('营养备份包含重复记录或账单关联');ids.add(meal.id);if(meal.expenseId)expenseIds.add(meal.expenseId);return meal;});
  return {meals,profile:value.profile===null?null:validateProfile(value.profile),photosIncluded:value.photosIncluded!==false};
}
export function weeklySummary(meals,endDate,targets) {
  const days=Array.from({length:7},(_,i)=>dayBefore(endDate,6-i)).map(date=>{
    const records=meals.filter(meal=>meal.date===date);return {date,count:records.length,totals:sumNutrition(records.flatMap(meal=>meal.items))};
  });
  const logged=days.filter(day=>day.count>0);
  const average=Object.fromEntries(nutrientKeys.map(key=>[key,logged.length?round(logged.reduce((sum,day)=>sum+day.totals[key],0)/logged.length):0]));
  const within=Object.fromEntries(nutrientKeys.map(key=>[key,targets?logged.filter(day=>rangeStatus(day.totals[key],targets[key])==='目标内').length:0]));
  return {days,loggedDays:logged.length,average,within};
}
export function validateAIAnalysis(result) {
  if(!result||!Array.isArray(result.foods)||result.foods.length>20||typeof result.note!=='string'||result.note.length>1000)throw new Error('AI返回的数据格式无效，请重试或手动记录');
  return {note:result.note,foods:result.foods.map(food=>{
    if(!food||typeof food.name!=='string'||!food.name.trim()||food.name.length>100||typeof food.assumption!=='string'||food.assumption.length>1000||!['high','medium','low'].includes(food.confidence))throw new Error('AI返回的食物信息无效');
    return {name:food.name,grams:number(food.grams,.01,10000,'AI估计份量'),per100:validateNutrients(food.per100),assumption:food.assumption,confidence:food.confidence};
  })};
}

export function standardizeAIFoods(foods){
 return foods.map(food=>{const known=findFood(food.name);return known&&!known.estimated?{...food,name:known.name,per100:{...known.per100},assumption:food.assumption.slice(0,700)+`；营养采用${known.reference} · ${known.sourceId}，份量由AI估计，可修改。`}:food;});
}
