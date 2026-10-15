export type Nutrients = { kcal:number; protein:number; carbs:number; fat:number };
export type NutrientKey = keyof Nutrients;
export type TargetRange = { min:number; max:number };
export type NutritionTargets = Record<NutrientKey,TargetRange>;
export type BodyProfile = { sex:'male'|'female'; age:number; heightCm:number; weightKg:number; activity:'sedentary'|'light'|'moderate'|'active'|'very-active'; goal:'lose'|'maintain'|'gain' };
export type NutritionProfile = { id:'main'; mode:'auto'|'manual'; body:BodyProfile|null; targets:NutritionTargets; updatedAt:number };
export type FoodDefinition = { id:string; name:string; group:string; aliases:string[]; per100:Nutrients; portions:Record<string,number|undefined>; defaultGrams:number; defaultUnit:string; reference:string; sourceId:string; sourceName:string; note:string; kind:'ingredient'|'recipe'; estimated?:boolean; ingredients?:{foodId:string;grams:number}[]; yieldGrams?:number };
export type FoodPortion = { id:string; foodId?:string; name:string; grams:number; per100:Nutrients; source:'dictionary'|'ai'|'manual'; sourceLabel:string; assumption:string; confidence?:'high'|'medium'|'low' };
export type MealType = '早餐'|'午餐'|'晚餐'|'加餐';
export type Meal = { id:string; date:string; mealType:MealType; items:FoodPortion[]; note:string; photo:string|null; expenseId:string|null; updatedAt:number };
export type AIConfiguration = {id:'ai';url:string};
export type Expense = {id:string;cents:number;category:string;date:string;note:string};
export type Budget = {month:string;cents:number};

export type AIAnalysis = {note:string;foods:{name:string;grams:number;per100:Nutrients;assumption:string;confidence:'high'|'medium'|'low'}[]};
