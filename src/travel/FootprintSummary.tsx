import {useState} from 'react';

type Entry={id:string;title:string;detail:string};
type Group={id:string;label:string;title:string;unit:string;count:number;items:Entry[];empty:string};
export default function FootprintSummary({scope,groups,onJournals}:{scope:'domestic'|'overseas';groups:Group[];onJournals:()=>void}){
  const [expanded,setExpanded]=useState<string|null>(null),[limit,setLimit]=useState(20);
  const choose=(id:string)=>{setExpanded(previous=>previous===id?null:id);setLimit(20);};
  return <section className="travel-footprints" aria-label={scope==='domestic'?'国内足迹统计':'海外足迹统计'}>
    <div className="travel-summary">{groups.map(group=><button key={group.id} type="button" aria-expanded={expanded===group.id} aria-controls={`footprints-${scope}-${group.id}`} onClick={()=>choose(group.id)}>
      <span>{group.label}</span><b>{group.count}<small>{group.unit}</small></b><em>{expanded===group.id?'收起':'查看详情'}</em>
    </button>)}</div>
    {groups.map(group=><div key={group.id} id={`footprints-${scope}-${group.id}`} className="travel-summary-details" hidden={expanded!==group.id}>
      <div className="travel-summary-details-heading"><h3>{group.title}</h3><button type="button" onClick={()=>setExpanded(null)} aria-label={`收起${group.title}`}>收起</button></div>
      {!group.items.length?<p className="travel-summary-empty">{group.empty}</p>:<><ul>{group.items.slice(0,limit).map(item=><li key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ul>
        {group.items.length>limit&&<button type="button" className="nutrition-soft-button" onClick={()=>setLimit(value=>value+20)}>再看 {Math.min(20,group.items.length-limit)} 项</button>}
        {group.id==='journeys'&&<button type="button" className="travel-summary-journals" onClick={onJournals}>打开{scope==='domestic'?'国内':'海外'}游记</button>}
      </>}
    </div>)}
  </section>;
}
