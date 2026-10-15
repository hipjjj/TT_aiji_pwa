import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foodLibrary,handPortionReferences,parseMealText,fistPortion} from '../src/nutrition/model.mjs';
test('fist quantities use food-specific USDA cup mass and distinguish cooked/raw density',()=>{
 for(const [text,grams] of [['米饭两拳',372],['半拳米饭',93],['两个拳头的米饭',372],['半个拳头米饭',93],['米饭半个拳头',93],['两拳头的米饭',372],['鸡胸肉半拳',70],['菠菜一拳',180],['生菠菜一拳',30],['米饭２拳',372]]){
  const r=parseMealText(text);assert.deepEqual(r.unresolved,[],text);assert.equal(r.items[0].grams,grams,text);assert.match(r.items[0].assumption,/粗估/);assert.match(r.items[0].assumption,/USDA/);
 }
 const mixed=parseMealText('米饭400g+鸡胸肉两拳+菠菜半拳');assert.deepEqual(mixed.items.map(x=>x.grams),[400,280,90]);
});
test('fist references preserve source identity, original household weights and editable assumptions',()=>{
 assert.equal(Object.keys(handPortionReferences).length,35);
 for(const [id,ref] of Object.entries(handPortionReferences)){
  const food=foodLibrary.find(f=>f.id===id);assert.equal(ref.sourceId,food.sourceId);assert.equal(ref.gramsPerFist,Math.round(ref.sourceGrams/ref.sourceAmount*100)/100);
  const item=fistPortion(food,1);assert.equal(item.grams,ref.gramsPerFist);assert.deepEqual(item.per100,food.per100);
 }
 assert.equal(fistPortion(foodLibrary.find(f=>f.id==='rice'),0),null);
 assert.equal(fistPortion(foodLibrary.find(f=>f.id==='rice'),100),null);
 for(const text of ['米饭0拳','米饭100拳','炒牛肉两拳','萝卜叶半拳','食用油一拳'])assert.equal(parseMealText(text).items.length,0,text);
});
