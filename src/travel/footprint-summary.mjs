import {cities,provinces,cityById,visitedCityIds} from './model.mjs';
import {countryName,overseasFootprints} from './overseas-model.mjs';
import {localDate} from '../nutrition/model.mjs';

const journeys=(trips,route,today)=>[...trips]
  .sort((a,b)=>b.startDate.localeCompare(a.startDate))
  .map(trip=>({id:trip.id,title:trip.title,detail:`${trip.startDate}—${trip.endDate}${trip.endDate>today?' · 规划中':''} · ${route(trip)}`}));
const group=(id,label,title,unit,items,empty)=>({id,label,title,unit,count:items.length,items,empty});

export function domesticFootprintGroups(trips,manual,today=localDate()){
  const visited=visitedCityIds(trips,manual,today);
  const reached=cities.filter(city=>visited.has(city.id));
  const regions=provinces.map(province=>{
    const places=reached.filter(city=>city.provinceId===province.id);
    return {id:province.id,title:province.name,detail:`${places.length} 个城市／地区 · ${places.map(city=>city.name).join('、')}`,count:places.length};
  }).filter(region=>region.count);
  const places=reached.map(city=>({id:city.id,title:city.name,detail:provinces.find(province=>province.id===city.provinceId)?.name||''}));
  return [
    group('regions','点亮的省级区域','点亮的省级区域','个',regions,'记录已完成的国内旅行，或在城市地图标记足迹后，省份就会点亮。'),
    group('cities','去过的城市／地区','去过的城市／地区','个',places,'还没有国内城市足迹，可以直接点地图留下小脚印。'),
    group('journeys','全部收好的旅程','国内旅程','段',journeys(trips,trip=>trip.stops.map(stop=>cityById(stop.cityId)?.name||'').filter(Boolean).join('、'),today),'还没有国内旅程，记下第一段旅行吧。'),
  ];
}

export function overseasFootprintGroups(trips,today=localDate()){
  const footprints=overseasFootprints(trips,today);
  const regions=[...footprints.countries].map(([code,places])=>({id:code,title:countryName(code),detail:`${places.size} 个城市 · ${[...places].join('、')}`}));
  const places=[...footprints.countries].flatMap(([code,citySet])=>[...citySet].map(city=>({id:`${code}|${city}`,title:city,detail:countryName(code)})));
  return [
    group('regions','点亮的国家／地区','点亮的国家／地区','个',regions,'记录已完成的海外旅行后，地图上的国家或地区就会点亮。'),
    group('cities','去过的海外城市','去过的海外城市','个',places,'还没有海外城市足迹，期待下一段远方的旅行。'),
    group('journeys','收好的海外旅程','海外旅程','段',journeys(trips,trip=>trip.stops.map(stop=>`${countryName(stop.countryCode)}·${stop.city}`).join('、'),today),'还没有海外旅程，记下第一段旅行吧。'),
  ];
}
