import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dexie, { type Table } from 'dexie';
import { categories, normalizeCategory, parseAmount, validDate, validateBackup } from './model.mjs';
import parkArt from './assets/penguin-park.webp';
import './style.css';

type Expense = { id:string; cents:number; category:string; date:string; note:string };
type Tab = 'bills' | 'stats' | 'backup';
const db = new Dexie('riri-expenses') as Dexie & {expenses:Table<Expense,string>};
db.version(1).stores({expenses:'id,date,category'});
db.version(2).stores({expenses:'id,date,category'}).upgrade(tx =>
  tx.table('expenses').where('category').equals('住房').modify({category:normalizeCategory('住房')})
);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const money = (cents:number) => (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const symbols:Record<string,string> = {餐饮:'🍱',食品日用:'🧺',生活缴费:'💡',交通:'🚋',购物:'🛍️',娱乐:'🎠',医疗:'🩹',旅行:'🧳',人情:'🎁',其他:'🎟️'};
const chartColors = ['#e4b45f','#d49c79','#a99acb','#79a9cb','#df949e','#b595c7','#e4a077','#8fb59a','#c987ac','#97a9b8'];
const share = (cents:number,total:number) => total ? (cents / total * 100 < 0.1 ? '<0.1%' : `${(cents / total * 100).toFixed(1)}%`) : '0%';
function ExpenseRecord({item,onEdit,onRemove}:{item:Expense;onEdit:(item:Expense)=>void;onRemove:(item:Expense)=>void}){
  return <article className="record"><span className={`category-icon category-${categories.indexOf(item.category)}`} aria-hidden="true">{symbols[item.category]}</span><div className="record-info"><strong>{item.note||item.category}</strong><p><span>{item.category}</span> {item.date.slice(5).replace('-','月')}日</p></div><div className="record-right"><b>− ¥{money(item.cents)}</b><div><button onClick={()=>onEdit(item)} aria-label={`编辑 ${item.date} ${item.category} ${money(item.cents)}`}>编辑</button><button onClick={()=>onRemove(item)} aria-label={`删除 ${item.date} ${item.category} ${money(item.cents)}`}>删除</button></div></div></article>;
}
function ExpensePie({data,total,onSelect}:{data:{category:string;sum:number}[];total:number;onSelect:(category:string)=>void}){
  let angle = -Math.PI / 2;
  const center = {x:180,y:140};
  const point = (radians:number,radius=84) => ({x:center.x+radius*Math.cos(radians),y:center.y+radius*Math.sin(radians)});
  const slices=data.map(item=>{
    const start=angle,sweep=item.sum/total*Math.PI*2;angle+=sweep;
    const from=point(start),to=point(angle),mid=start+sweep/2;
    const path=data.length===1 ? 'M 180 56 A 84 84 0 1 1 180 224 A 84 84 0 1 1 180 56 Z' : `M 180 140 L ${from.x} ${from.y} A 84 84 0 ${sweep>Math.PI?1:0} 1 ${to.x} ${to.y} Z`;
    return {...item,path,mid,right:Math.cos(mid)>=0,labelY:point(mid,98).y};
  });
  for(const right of [false,true]){
    const side=slices.filter(item=>item.right===right).sort((a,b)=>a.labelY-b.labelY);
    side.forEach((item,index)=>{item.labelY=Math.max(26,item.labelY,index?side[index-1].labelY+24:26);});
    for(let index=side.length-1;index>=0;index--)side[index].labelY=Math.min(side[index].labelY,index===side.length-1?254:side[index+1].labelY-24);
  }
  return <figure className="expense-pie"><svg viewBox="0 0 360 280" role="group" aria-label="分类支出占比饼图">{slices.map(item=><path key={item.category} d={item.path} fill={chartColors[categories.indexOf(item.category)]} stroke="#fffcf7" strokeWidth="2" role="button" tabIndex={0} aria-label={`${item.category}，${share(item.sum,total)}，查看明细`} onClick={()=>onSelect(item.category)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(item.category);}}}><title>{item.category} · ¥{money(item.sum)} · {share(item.sum,total)}</title></path>)}
    <g className="pie-labels" aria-hidden="true">{slices.map(item=>{
      if(slices.length===1)return <text key={item.category} x="180" y="145" textAnchor="middle" className="pie-label-single">{item.category}</text>;
      const edge=point(item.mid),elbow=point(item.mid,94),labelX=item.right?280:80,lineX=item.right?274:86;
      return <g key={item.category}><polyline points={`${edge.x},${edge.y} ${elbow.x},${elbow.y} ${lineX},${item.labelY}`} fill="none" stroke={chartColors[categories.indexOf(item.category)]} strokeWidth="1.4"/><circle cx={lineX} cy={item.labelY} r="2" fill={chartColors[categories.indexOf(item.category)]}/><text x={labelX} y={item.labelY} dominantBaseline="middle" textAnchor={item.right?'start':'end'}>{item.category}</text></g>;
    })}</g>
  </svg><figcaption>点一下色块，看看每一张小票</figcaption></figure>;
}
function Icon({kind}:{kind:Tab}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='bills'?<><path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6Z"/><path d="m12 8 1.2 2.4 2.6.4-1.9 1.8.5 2.7-2.4-1.3-2.4 1.3.5-2.7-1.9-1.8 2.6-.4Z"/></>:kind==='stats'?<><path d="M5 20V12M12 20V4M19 20V9" strokeWidth="4"/></>:<><path d="M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-1 4.5 4.5 0 0 1 0 9h-1"/><path d="M12 21V12m-3 3 3-3 3 3"/></>}</svg>;}
function App(){
  const [items,setItems]=useState<Expense[]>([]), [month,setMonth]=useState(today().slice(0,7)),[tab,setTab]=useState<Tab>('bills');
  const [selectedCategory,setSelectedCategory]=useState<string|null>(null);
  const statsHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{statsHeading.current?.focus();},[selectedCategory]);
  const [amount,setAmount]=useState(''),[category,setCategory]=useState('餐饮'),[date,setDate]=useState(today()),[note,setNote]=useState('');
  const [editing,setEditing]=useState<string|null>(null),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[online,setOnline]=useState(navigator.onLine),[formOpen,setFormOpen]=useState(false);
  const file = useRef<HTMLInputElement>(null), amountInput=useRef<HTMLInputElement>(null), dialog=useRef<HTMLDialogElement>(null);
  const refresh=async()=>setItems(await db.expenses.orderBy('date').reverse().toArray());
  useEffect(()=>{refresh().then(()=>setReady(true)).catch(()=>setMessage('无法访问本地存储，请检查浏览器的隐私设置。')); const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{if(formOpen){dialog.current?.showModal();amountInput.current?.focus();}else dialog.current?.close();},[formOpen]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message]);
  const reset=()=>{setEditing(null);setAmount('');setNote('');setCategory('餐饮');setDate(today());};
  const openNew=()=>{reset();setFormOpen(true);};
  const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{if(!validDate(date))throw new Error('请选择有效日期');await db.expenses.put({id:editing??crypto.randomUUID(),cents:parseAmount(amount),category,date,note:note.trim()});await refresh();setMonth(date.slice(0,7));if(!editing)setTab('bills');setFormOpen(false);setMessage(editing?'账单已更新':'记好啦！小企鹅帮你收好这张小票了');reset();}catch(e){setMessage(e instanceof Error?e.message:'保存失败，请重试');}finally{setBusy(false);}};
  const edit=(item:Expense)=>{setEditing(item.id);setAmount((item.cents/100).toFixed(2));setCategory(item.category);setDate(item.date);setNote(item.note);setFormOpen(true);};
  const remove=async(item:Expense)=>{if(!confirm(`删除这笔 ¥${money(item.cents)} 的${item.category}开销？`))return;try{await db.expenses.delete(item.id);await refresh();if(editing===item.id){reset();setFormOpen(false);}setMessage('这张小票已删除');}catch{setMessage('删除失败，请重试');}};
  const exportData=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,expenses:items},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`天天爱记备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('备份已导出，请妥善保存');};
  const importData=async(e:React.ChangeEvent<HTMLInputElement>)=>{const selected=e.target.files?.[0];if(!selected)return;setBusy(true);try{if(selected.size>20*1024*1024)throw new Error('备份文件不能超过 20 MB');const entries=validateBackup(JSON.parse(await selected.text())) as Expense[];if(!confirm(`导入 ${entries.length} 笔账单？相同编号会更新，其他账单会保留。`))return;await db.transaction('rw',db.expenses,()=>db.expenses.bulkPut(entries));await refresh();setMessage(`已导入 ${entries.length} 笔账单`);}catch(e){setMessage(e instanceof Error?e.message:'导入失败');}finally{e.target.value='';setBusy(false);}};
  const current=items.filter(i=>i.date.startsWith(month));const total=current.reduce((sum,i)=>sum+i.cents,0);
  const breakdown=categories.map(c=>({category:c,sum:current.filter(i=>i.category===c).reduce((s,i)=>s+i.cents,0)})).filter(i=>i.sum>0).sort((a,b)=>b.sum-a.sum);
  const selectedItems=current.filter(item=>item.category===selectedCategory);
  const selectedTotal=selectedItems.reduce((sum,item)=>sum+item.cents,0);
  return <><main>
    <header className="topbar"><a className="brand" href="./"><span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}penguin-icon.svg`} alt=""/></span> 天天爱记</a><span className="status"><i/>{online?'离线也能记':'离线模式'}</span></header>
    <section className="hero" aria-label="企鹅游乐园"><img src={parkArt} alt="戴着小票帽的毛绒企鹅，抱着粉色游乐券坐在旋转木马旁"/><div className="hero-copy"><span className="park-label">PENGUIN PLAYGROUND</span><h1>生活的小快乐，<br/>每天都值得记。</h1><p>欢迎来到你的企鹅游乐园 <span aria-hidden="true">✧</span></p></div><span className="hero-star" aria-hidden="true">✦</span></section>
    {tab!=='backup'&&<section className="ticket" aria-label="月度开销"><div className="ticket-top"><h2>本月开销</h2><label className="month-picker"><span className="sr-only">查看月份</span><input aria-label="查看月份" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div><div className="total"><span>¥</span>{money(total)}</div><div className="ticket-bottom"><p>这个月记了 <b>{current.length}</b> 笔 <span>· 人民币</span></p><span className="ticket-stamp" aria-hidden="true">HAPPY<br/>LITTLE DAYS</span></div><span className="ticket-star" aria-hidden="true">✧</span></section>}
    {tab==='bills'&&<><button className="new-expense" onClick={openNew} disabled={!ready||busy}><span>＋</span> 记一笔 <span className="button-star" aria-hidden="true">★</span></button><section className="records"><div className="section-head"><h2>最近账单 <span aria-hidden="true">✧</span></h2><span>{month.replace('-',' 年 ')} 月</span></div>{!ready?<p className="empty">小企鹅正在打开账本…</p>:!current.length?<div className="empty"><span className="empty-ticket" aria-hidden="true">🎟️</span><h3>第一张小票，留给今天</h3><p>记下一杯咖啡，或今天的午餐。</p><button onClick={openNew}>＋ 记下第一笔</button></div>:current.map(item=><ExpenseRecord key={item.id} item={item} onEdit={edit} onRemove={remove}/>)}</section></>}
    {tab==='stats'&&<section className="stats-panel">
      {selectedCategory ? <>
        <button className="stats-back" onClick={()=>setSelectedCategory(null)}>‹ 返回分类统计</button>
        <div className="section-head"><h2 ref={statsHeading} tabIndex={-1}>{symbols[selectedCategory]} {selectedCategory} · 月度明细</h2></div>
        <p className="detail-month">{month.replace('-',' 年 ')} 月 · 按日期从新到旧</p>
        <div className="category-summary"><span>本月该分类支出</span><b>¥{money(selectedTotal)}</b><p>{selectedItems.length} 笔小票 · 占本月开销 {share(selectedTotal,total)}</p></div>
        <div className="detail-records">{selectedItems.length ? selectedItems.map(item=><ExpenseRecord key={item.id} item={item} onEdit={edit} onRemove={remove}/>) : <div className="empty"><span className="empty-ticket" aria-hidden="true">🎟️</span><h3>这个月还没有{selectedCategory}小票</h3><p>试试切换月份，或记下一笔新的开销。</p></div>}</div>
      </> : <>
        <div className="section-head"><h2 ref={statsHeading} tabIndex={-1}>钱都去哪儿啦？</h2><span>分类统计</span></div>
        {!ready?<p className="empty">正在整理小票…</p>:!total?<div className="empty"><span className="empty-ticket" aria-hidden="true">🎠</span><h3>还没有这个月的小票</h3><p>记下开销后，小企鹅会在这里帮你算好。</p></div>:<>
          <div className="chart-overview"><ExpensePie data={breakdown} total={total} onSelect={setSelectedCategory}/><div className="stats-highlights"><div><span>平均每笔</span><b>¥{money(Math.round(total/current.length))}</b></div><div><span>开销最多</span><b>{symbols[breakdown[0].category]} {breakdown[0].category}</b></div></div></div>
          <p className="category-list-hint">点击分类，查看当月逐笔开支 <span aria-hidden="true">↘</span></p>
          <div className="breakdown">{breakdown.map(i=><button className="category-stat" key={i.category} onClick={()=>setSelectedCategory(i.category)} aria-label={`查看${i.category}当月明细`}><span className="legend-dot" style={{background:chartColors[categories.indexOf(i.category)]}}/><span className="category-stat-name">{symbols[i.category]} {i.category}<small>{current.filter(item=>item.category===i.category).length} 笔</small></span><span className="category-stat-amount"><b>¥{money(i.sum)}</b><small>{share(i.sum,total)}</small></span><span className="category-chevron" aria-hidden="true">›</span></button>)}</div>
        </>}
      </>}
    </section>}
    {tab==='backup'&&<section className="backup-panel"><span className="backup-illustration" aria-hidden="true">☁️</span><span className="park-label">KEEP YOUR LITTLE MEMORIES</span><h2>给小票一个安全的家</h2><p>你的 <b>{items.length}</b> 笔账单保存在这台设备的浏览器里。<br/>导出一份备份，把生活的小记录好好收起来。</p><button className="backup-primary" disabled={!ready||busy} onClick={exportData}>↓ 导出备份</button><button className="backup-secondary" disabled={!ready||busy} onClick={()=>file.current?.click()}>↑ 导入备份</button><div className="backup-note"><strong>小企鹅提醒你</strong><p>无需登录，离线可用。清理浏览器数据会删除账单，请定期备份。导入时相同编号会更新，其他账单会保留。备份文件包含账单明文，请妥善保管。</p></div></section>}
    <input hidden type="file" accept="application/json,.json" ref={file} onChange={importData}/>
    <footer>✦ 小小记录，暖暖生活 ✦<p>浏览器菜单 → 安装应用 / 添加到主屏幕</p></footer>
  </main>
  <nav className="bottom-nav" aria-label="主导航">{([['bills','账单'],['stats','统计'],['backup','备份']] as const).map(([id,name])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setSelectedCategory(null);setMessage('');}}><Icon kind={id}/><span>{name}</span></button>)}</nav>
  <dialog ref={dialog} className="entry-dialog" aria-labelledby="entry-title" onCancel={()=>setFormOpen(false)} onClose={()=>setFormOpen(false)}><div className="entry-heading"><div><span className="park-label">ONE MORE LITTLE MEMORY</span><h2 id="entry-title">{editing?'编辑这张小票':'记一笔小快乐'}</h2></div><button className="close" aria-label="关闭记账" disabled={busy} onClick={()=>setFormOpen(false)}>×</button></div><form onSubmit={save}><label>金额 <span>人民币</span><div className="amount-field"><span>¥</span><input ref={amountInput} aria-label="金额" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} required/></div></label><fieldset><legend>花在哪里？</legend><div className="categories">{categories.map(c=><button type="button" key={c} aria-pressed={category===c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{symbols[c]} {c}</button>)}</div></fieldset><div className="form-fields"><label>日期<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>备注 <span>选填</span><input placeholder="这笔钱花在哪里？" value={note} onChange={e=>setNote(e.target.value)} maxLength={200}/></label></div><button className="primary" disabled={!ready||busy}>{busy?'正在保存…':editing?'保存修改':'＋ 记好了'}</button><p className="form-hint">每一笔小票，企鹅都会认真收好 ♡</p></form>{formOpen&&<p className="form-message" role="status">{message}</p>}</dialog>
  {!formOpen&&<div className={`toast ${message?'visible':''}`} role="status">{message}</div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
