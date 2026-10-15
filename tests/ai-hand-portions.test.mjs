import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiHandPortionReferences,handPortionReferences,fistPortionLibrary,foodLibrary,findFood,parseMealText,fistPortion,validateMeal,validateNutritionBackup} from '../src/nutrition/model.mjs';
test('AI fist library is separate, bounded, labeled low-confidence and never replaces sourced cup weights',()=>{
 assert.equal(Object.keys(aiHandPortionReferences).length,62);assert.equal(fistPortionLibrary.length,97);
 assert.equal(new Set(fistPortionLibrary.map(x=>x.foodId)).size,97);
 for(const [id,ref] of Object.entries(aiHandPortionReferences)){
  assert(!handPortionReferences[id]);assert(ref.minGrams>0&&ref.minGrams<=ref.gramsPerFist&&ref.maxGrams>=ref.gramsPerFist&&ref.maxGrams<=1000);assert.equal(ref.basis,'ai_estimate');assert.equal(ref.confidence,'low');
  const food=foodLibrary.find(f=>f.id===id);assert(food,id);const item=fistPortion(food,1);assert.equal(item.confidence,'low');assert.equal(item.grams,ref.gramsPerFist);assert.match(item.sourceLabel,/AI粗估/);assert.match(item.assumption,/非实测/);assert.deepEqual(item.per100,food.per100);
 }
 assert.equal(fistPortion(findFood('米饭'),1).grams,186);
 for(const text of ['食用油一拳','未知食物一拳','米饭0拳','牛肉1000拳'])assert.equal(parseMealText(text).items.length,0,text);
});
test('original rice/beef/radish entry resolves offline with separately labeled nutrition assumptions and survives backup',()=>{
 const result=parseMealText('米饭400g+炒牛肉两拳+萝卜叶半拳');assert.deepEqual(result.unresolved,[]);assert.deepEqual(result.items.map(x=>x.grams),[400,300,80]);
 assert.match(result.items[1].sourceLabel,/参考配方/);assert.match(findFood('炒牛肉').note,/油10克/);assert.match(result.items[1].assumption,/含配方中的油/);
 assert.match(result.items[2].sourceLabel,/AI营养参考估算/);assert.match(result.items[2].assumption,/未计额外烹调油/);assert.match(findFood('萝卜叶').note,/不是USDA/);
 const meal=validateMeal({id:'ai-fist',date:'2026-10-15',mealType:'午餐',items:result.items,note:'',photo:null,expenseId:null,updatedAt:1});
 const restored=validateNutritionBackup({nutrition:{meals:[meal],profile:null}});assert.deepEqual(restored.meals[0].items,meal.items);
 const changed=validateMeal({...meal,items:meal.items.map((item,i)=>i===1?{...item,grams:220}:item)});assert.equal(changed.items[1].grams,220);
});

test('live AI nutrition for new estimated foods is not overwritten by pre-estimated library values',async()=>{
 const {standardizeAIFoods}=await import('../src/nutrition/model.mjs');
 const live={name:'萝卜叶',grams:90,per100:{kcal:35,protein:3,carbs:5,fat:.5},assumption:'本次照片估计',confidence:'medium'};
 assert.deepEqual(standardizeAIFoods([live])[0],live);
});
