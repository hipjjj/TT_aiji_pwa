import Dexie, { type Table } from 'dexie';
import { normalizeCategory } from './model.mjs';
import type { AIConfiguration, Budget, Expense, Meal, NutritionProfile } from './nutrition/types';
export const db=new Dexie('riri-expenses') as Dexie & {
  expenses:Table<Expense,string>;budgets:Table<Budget,string>;meals:Table<Meal,string>;nutritionProfiles:Table<NutritionProfile,string>;settings:Table<AIConfiguration,string>;
};
db.version(1).stores({expenses:'id,date,category'});
db.version(2).stores({expenses:'id,date,category'}).upgrade(tx=>tx.table('expenses').where('category').equals('住房').modify({category:normalizeCategory('住房')}));
db.version(3).stores({expenses:'id,date,category',budgets:'month'});
db.version(4).stores({expenses:'id,date,category',budgets:'month',meals:'id,date,mealType,expenseId',nutritionProfiles:'id',settings:'id'});
