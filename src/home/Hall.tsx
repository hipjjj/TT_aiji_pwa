import {Biao, Character, Family, WorkPair} from './Characters';

export type Destination = 'bills'|'dining'|'travel'|'prep'|'study'|'personal';
export const destinations = [
  {id:'bills', name:'记账', note:'鲍比的钱柜', character:'鲍比'},
  {id:'dining', name:'吃饭', note:'小包请你吃饭', character:'小包'},
  {id:'travel', name:'旅行', note:'黏黏包带路', character:'黏黏包'},
  {id:'prep', name:'工作', note:'两只小企鹅值班', character:'邪恶包'},
  {id:'study', name:'学习', note:'和嘟嘟糕学英语', character:'嘟嘟糕'},
  {id:'personal', name:'个人', note:'设置与数据备份', character:null},
] as const;
export default function Hall({onNavigate,onChat}:{onNavigate:(id:Destination)=>void;onChat:()=>void}) {
  return <section className="hall" aria-labelledby="hall-title">
    <div className="hall-heading"><span className="eyebrow">OUR LITTLE PENGUIN WORLD</span><h1 id="hall-title">企鹅家族大厅</h1><p>今天想和谁一起做点什么？</p></div>
    <nav className="circle-hall" aria-label="圆形入口大厅">
      <span className="orbit-path" aria-hidden="true"/><span className="hall-spark spark-one" aria-hidden="true">✧</span><span className="hall-spark spark-two" aria-hidden="true">✦</span>
      <button className="home-door" onClick={onChat} aria-label="进入企鹅小家聊天"><strong>企鹅小家</strong><Family/><span className="chat-pill">点我聊天 <b>↗</b></span></button>
      {destinations.map((room,index)=><button key={room.id} className={`hall-door hall-door-${index}`} onClick={()=>onNavigate(room.id)}><span className="door-picture">{room.id==='prep'?<WorkPair/>:room.character?<Character name={room.character}/>:<Biao/>}</span><strong>{room.name}</strong><small>{room.note}</small></button>)}
    </nav>
    <p className="hall-caption"><span aria-hidden="true">✿</span> 把生活的小事，交给企鹅朋友</p>
  </section>;
}
