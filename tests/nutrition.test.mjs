import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateTargets,dayBefore,findFood,foodLibrary,makePortion,parseMealText,rangeStatus,sumNutrition,validateAIAnalysis,validateMeal,validateNutrients,validateNutritionBackup,validateProfile,weeklySummary} from '../src/nutrition/model.mjs';
const body={sex:'male',age:30,heightCm:175,weightKg:70,activity:'moderate',goal:'maintain'};
const meal=(date='2026-10-12')=>({id:'meal-1',date,mealType:'午餐',items:[makePortion(findFood('米饭'),150)],note:'',photo:null,expenseId:null,updatedAt:1});
test('sourced dictionary has 115 foods and reproducible recipe nutrition',()=>{
 assert.equal(foodLibrary.length,115);
 for(const food of foodLibrary){validateNutrients(food.per100);assert.ok(food.sourceId&&food.sourceName&&food.reference);if(food.kind==='recipe'){for(const key of ['kcal','protein','carbs','fat']){const expected=Math.round(food.ingredients.reduce((sum,item)=>sum+Math.round(foodLibrary.find(row=>row.id===item.foodId).per100[key]*100)*item.grams,0)/food.yieldGrams)/100;assert.equal(food.per100[key],expected);}}}
});
test('Chinese dictionary parsing uses cooked weight and sums real SR28 nutrients',()=>{
 const result=parseMealText('米饭150克、鸡胸肉100克、一个鸡蛋');assert.deepEqual(result.unresolved,[]);assert.deepEqual(result.items.map(row=>row.grams),[150,100,50]);assert.deepEqual(sumNutrition(result.items),{kcal:423.5,protein:38.8,carbs:43.4,fat:8.7});
});
test('household quantities, aliases, kg, full-width digits and unknown fragments are explicit',()=>{
 const result=parseMealText('半碗米饭；２个鸡蛋；0.1公斤鸡胸肉；番茄100克；一杯牛奶；神秘奶茶');assert.deepEqual(result.items.map(row=>row.grams),[75,100,100,100,250]);assert.equal(result.unresolved.length,1);assert.equal(result.unresolved[0].text,'神秘奶茶');assert.match(result.items[0].assumption,/估计/);assert.equal(parseMealText('米饭').items[0].grams,150);assert.equal(parseMealText('米饭0克').unresolved.length,1);assert.equal(parseMealText('一碗鸡胸肉').unresolved.length,1);
});
test('adult calorie advice uses Mifflin formula and adapts to goals and activity',()=>{
 const result=calculateTargets(body);assert.equal(result.bmr,1649);assert.equal(result.maintenance,2556);assert.deepEqual(result.targets.kcal,{min:2304,max:2816});assert.ok(calculateTargets({...body,goal:'lose'}).targets.kcal.max<result.targets.kcal.max);assert.ok(calculateTargets({...body,goal:'gain'}).targets.kcal.max>result.targets.kcal.max);assert.ok(calculateTargets({...body,activity:'sedentary'}).maintenance<result.maintenance);assert.throws(()=>calculateTargets({...body,age:17}));assert.throws(()=>calculateTargets({...body,age:20.5}));assert.throws(()=>calculateTargets({...body,weightKg:45,goal:'lose'}));assert.throws(()=>calculateTargets({...body,sex:''}));
});
test('manual profile validates independent target ranges',()=>{
 const targets={kcal:{min:1600,max:2000},protein:{min:80,max:120},carbs:{min:180,max:250},fat:{min:40,max:70}};
 assert.equal(validateProfile({id:'main',mode:'manual',body:null,targets,updatedAt:1}).targets.protein.min,80);assert.throws(()=>validateProfile({id:'main',mode:'manual',targets:{...targets,kcal:{min:2000,max:1600}},updatedAt:1}));assert.equal(rangeStatus(70,targets.protein),'低于目标');assert.equal(rangeStatus(80,targets.protein),'目标内');assert.equal(rangeStatus(121,targets.protein),'超出目标');
});
test('weekly average uses logged days, omitting gaps, and handles year boundaries',()=>{
 const records=[meal('2026-10-10'),{...meal('2026-10-12'),id:'meal-2'}];const week=weeklySummary(records,'2026-10-12');assert.equal(week.loggedDays,2);assert.equal(week.average.kcal,195);assert.equal(week.days.filter(day=>!day.count).length,5);assert.equal(dayBefore('2026-01-01',1),'2025-12-31');assert.equal(dayBefore('2024-03-01',1),'2024-02-29');
});
test('nutrition backup preserves snapshots, rejects duplicates and unsafe images, and accepts legacy absence',()=>{
 const original=meal();assert.deepEqual(validateNutritionBackup({nutrition:{meals:[original],profile:null}}),{meals:[original],profile:null,photosIncluded:true});assert.equal(validateNutritionBackup({version:1,expenses:[]}),null);assert.throws(()=>validateNutritionBackup({nutrition:{meals:[original,original],profile:null}}));assert.throws(()=>validateMeal({...original,photo:'https://example.com/photo.jpg'}));assert.throws(()=>validateMeal({...original,photo:'data:image/svg+xml;base64,PHN2Zz4='}));assert.throws(()=>validateMeal({...original,items:[{...original.items[0],grams:NaN}]}));assert.throws(()=>validateNutritionBackup({nutrition:{meals:[{...original,expenseId:'same'},{...original,id:'second',expenseId:'same'}],profile:null}}));
});
test('AI results require bounded nutrients, weights and confidence; data cannot be silently trusted',()=>{
 const value={note:'估计份量',foods:[{name:'米饭',grams:150,per100:{kcal:130,protein:2.38,carbs:28.59,fat:.21},assumption:'约一碗',confidence:'medium'}]};assert.equal(validateAIAnalysis(value).foods.length,1);assert.throws(()=>validateAIAnalysis({...value,foods:[{...value.foods[0],grams:-1}]}));assert.throws(()=>validateNutrients({kcal:900,protein:100,carbs:100,fat:100}));assert.throws(()=>validateAIAnalysis({...value,foods:[{...value.foods[0],confidence:'certain'}]}));
});

test('plus-separated meals preserve known foods and clearly flag fist portions without inventing weights',()=>{
 const result=parseMealText('米饭400g+炒牛肉两拳+萝卜叶半拳');
 assert.equal(result.items.length,1);assert.equal(result.items[0].foodId,'rice');assert.equal(result.items[0].grams,400);
 assert.deepEqual(result.unresolved.map(x=>x.text),['炒牛肉两拳','萝卜叶半拳']);
 assert(result.unresolved.every(x=>x.reason.includes('没有固定克重')&&x.reason.includes('AI')));
 assert.equal(parseMealText('米饭100g＋鸡蛋1个').items.length,2);
 assert.equal(parseMealText('两拳头米饭').items[0].grams,372);
 assert.equal(parseMealText('鸡胸肉半拳').items[0].grams,70);
 assert.throws(()=>parseMealText(Array(21).fill('米饭100克').join('+')));
});
