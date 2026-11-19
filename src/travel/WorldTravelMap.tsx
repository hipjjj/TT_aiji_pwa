import {useEffect,useState} from 'react';
import {Modal} from '../nutrition/NutritionTab';
import {countries,countryName} from './overseas-model.mjs';
import {geometryPath} from './map.mjs';
import {worldMapPoint} from './world-map.mjs';
import type {MapFeature} from './types';

type WorldMapData={type:'FeatureCollection';features:MapFeature[];places:{code:string;center:number[]}[]};
const supported=new Set(countries.map(country=>country.code));
export default function WorldTravelMap({visited,onRecord}:{visited:Map<string,Set<string>>;onRecord:(code:string)=>void}){
  const [data,setData]=useState<WorldMapData|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setData(null);setError('');
    fetch(`${import.meta.env.BASE_URL}travel-maps/world.json`,{signal:controller.signal})
      .then(response=>{if(!response.ok)throw Error('世界地图暂时没有载入，请重试');return response.json();})
      .then(value=>{if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||!value.features.length||!Array.isArray(value.places))throw Error('世界地图数据无效');setData(value);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'地图加载失败');});
    return()=>controller.abort();
  },[attempt]);
  const shapes=new Set(data?.features.map(feature=>feature.properties.id));
  const dots=data?.places.filter(place=>supported.has(place.code)&&!shapes.has(place.code))||[];
  const labels=data?.places.filter(place=>supported.has(place.code)&&visited.has(place.code))||[];
  const choose=(code:string)=>{if(supported.has(code))setSelected(code);};
  const keyboard=(event:React.KeyboardEvent<SVGElement>,code:string)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(code);}};
  return <section className="travel-map-card world-map-card">
    <div className="travel-map-heading"><div><span className="park-label">Little Footprints</span><h3>海外旅行足迹</h3></div><div className="travel-legend"><span><i/>去过</span><span><i/>没去过</span></div></div>
    <div className="travel-breadcrumb"><strong>世界</strong><span>{visited.size} 个国家／地区已点亮</span></div>
    {!data?<div className="travel-map-loading" role="status">{error?<><p>{error}</p><button onClick={()=>setAttempt(value=>value+1)}>重新加载地图</button></>:'黏黏包正在展开世界地图…'}</div>:
      <svg className="travel-map world-travel-map" viewBox="0 0 620 440" role="group" aria-label="海外旅行世界地图">
        <g className="world-map-grid" aria-hidden="true">{[-60,-30,0,30,60].map(latitude=><path key={latitude} d={`M16,${worldMapPoint([0,latitude])[1]}H604`}/>)}{[-120,-60,0,60,120].map(longitude=><path key={longitude} d={`M${worldMapPoint([longitude,0])[0]},73V367`}/>)}</g>
        <g className="travel-map-main world-map-land">{data.features.map(feature=>{const code=feature.properties.id,interactive=supported.has(code);return <path key={code} d={geometryPath(feature.geometry,worldMapPoint)} className={`${visited.has(code)?'map-visited ':''}${interactive?'':'world-map-background'}`} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`${countryName(code)}，${visited.has(code)?'去过':'没去过'}，查看海外足迹`:undefined} onClick={()=>choose(code)} onKeyDown={event=>keyboard(event,code)}><title>{countryName(code)||'地图区域'}</title></path>;})}</g>
        <g className="world-map-dots">{dots.map(place=>{const [x,y]=worldMapPoint(place.center);return <circle key={place.code} cx={x} cy={y} r="4" className={visited.has(place.code)?'map-visited':''} role="button" tabIndex={0} aria-label={`${countryName(place.code)}，${visited.has(place.code)?'去过':'没去过'}，查看海外足迹`} onClick={()=>choose(place.code)} onKeyDown={event=>keyboard(event,place.code)}><title>{countryName(place.code)}</title></circle>;})}</g>
        <g className="world-map-stars" aria-hidden="true">{labels.map(place=>{const [x,y]=worldMapPoint(place.center);return <text key={place.code} x={x} y={y-7} textAnchor="middle">★</text>;})}</g>
      </svg>}
    <p className="travel-map-note">点击国家或小圆点，看看留下的小脚印。</p>
    <details className="world-country-picker"><summary>按名称查找国家／地区</summary><label><span className="sr-only">选择海外国家</span><select aria-label="选择海外国家" value="" onChange={event=>choose(event.target.value)}><option value="">选择国家／地区</option>{countries.map(country=><option key={country.code} value={country.code}>{country.name}{visited.has(country.code)?' · 去过':''}</option>)}</select></label></details>
    <details className="travel-map-source"><summary>地图数据来源</summary><p>概略世界地图来自 <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth（公有领域）</a>；小圆点参考 <a href="https://github.com/mledoze/countries" target="_blank" rel="noreferrer">mledoze/countries（ODbL 1.0）</a> 的国家／地区中心点。地图与中心点为 2026-11-19 快照，仅用于旅行足迹展示。</p></details>
    <Modal open={!!selected} onClose={()=>setSelected('')} title={countryName(selected)||'海外足迹'} eyebrow="NIANNIAN BAO’S OVERSEAS FOOTPRINTS" className="travel-dialog">
      <p className="travel-city-status">{visited.has(selected)?'★ 已点亮 · 黏黏包记得你来过':'○ 还没点亮 · 等你留下足迹'}</p>
      {visited.has(selected)?<><h3>去过的城市</h3><div className="world-visited-cities">{[...(visited.get(selected)||[])].map(city=><span key={city}>{city}</span>)}</div></>:<p className="nutrition-small-note">记录已完成的海外旅行后，这里就会亮起来。</p>}
      <button className="primary" onClick={()=>{const code=selected;setSelected('');onRecord(code);}}>记录这里的旅行</button>
    </Modal>
  </section>;
}
