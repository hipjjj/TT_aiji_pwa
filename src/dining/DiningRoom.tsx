import {useState} from 'react';
import NutritionTab from '../nutrition/NutritionTab';
import FridgeTab from '../fridge/FridgeTab';
export type DiningSection='meals'|'inventory'|'recipes'|'shopping';
export default function DiningRoom({initialSection='meals',initialDate,onDataChange,onManageAI}:{initialSection?:DiningSection;initialDate?:string;onDataChange:()=>Promise<void>;onManageAI:()=>void}) {
  const [section,setSection]=useState<DiningSection>(initialSection);
  return <div className="dining-room"><div className="room-tabs" role="group" aria-label="吃饭小屋功能">{([['meals','饮食记录'],['inventory','我的冰箱'],['recipes','今天吃什么'],['shopping','购物清单']] as const).map(([id,name])=><button key={id} aria-pressed={section===id} onClick={()=>setSection(id)}>{name}</button>)}</div>
    {section==='meals'?<NutritionTab initialDate={initialDate} onDataChange={onDataChange} onManageAI={onManageAI}/>:<FridgeTab key={section} initialView={section} hideNavigation onDataChange={onDataChange} onManageAI={onManageAI}/>}
  </div>;
}
