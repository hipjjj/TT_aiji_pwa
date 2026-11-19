import {test} from 'node:test';
import assert from 'node:assert/strict';
import {domesticFootprintGroups,overseasFootprintGroups} from '../src/travel/footprint-summary.mjs';

const today='2026-11-19';
test('domestic summary lists completed and manual footprints while keeping planned journeys separate',()=>{
  const trips=[
    {id:'hangzhou',title:'杭州宁波',startDate:'2026-10-01',endDate:'2026-10-03',stops:[{cityId:'330100'},{cityId:'330200'}],photos:[{id:'photo',dataURL:'saved-photo'}]},
    {id:'again',title:'再去杭州',startDate:'2026-11-01',endDate:'2026-11-02',stops:[{cityId:'330100'}]},
    {id:'planned',title:'未来的上海',startDate:'2027-01-01',endDate:'2027-01-03',stops:[{cityId:'310000'}]},
  ];
  const manual=[{cityId:'110000',date:null,note:'小时候来过'}];
  const snapshot=structuredClone({trips,manual});
  const [regions,cities,journeys]=domesticFootprintGroups(trips,manual,today);
  assert.equal(regions.count,2);
  assert.equal(cities.count,3);
  assert.equal(journeys.count,3);
  assert(!regions.items.some(row=>row.id==='310000'));
  assert(!cities.items.some(row=>row.id==='310000'));
  assert.match(regions.items.find(row=>row.id==='330000').detail,/杭州市、宁波市/);
  assert.match(journeys.items[0].detail,/规划中/);
  assert.deepEqual(journeys.items.map(row=>row.id),['planned','again','hangzhou']);
  assert.deepEqual({trips,manual},snapshot);
});
test('overseas summary expands the exact countries, deduplicated cities and overseas journeys',()=>{
  const trips=[
    {id:'abroad',title:'日本法国',startDate:'2026-10-01',endDate:'2026-10-03',stops:[{countryCode:'JP',city:'Tokyo'},{countryCode:'FR',city:'巴黎'}]},
    {id:'again',title:'再去日本',startDate:'2026-10-05',endDate:'2026-10-07',stops:[{countryCode:'JP',city:'tokyo'}]},
    {id:'planned',title:'未来美国',startDate:'2027-01-01',endDate:'2027-01-03',stops:[{countryCode:'US',city:'纽约'}]},
  ];
  const snapshot=structuredClone(trips);
  const [countries,cities,journeys]=overseasFootprintGroups(trips,today);
  assert.deepEqual(countries.items.map(row=>row.id),['JP','FR']);
  assert.equal(countries.count,2);
  assert.equal(cities.count,2);
  assert.equal(journeys.count,3);
  assert.match(countries.items[0].detail,/1 个城市 · Tokyo/);
  assert(cities.items.some(row=>row.title==='巴黎'&&row.detail==='法国'));
  assert.match(journeys.items.find(row=>row.id==='planned').detail,/规划中.*美国·纽约/);
  assert.deepEqual(trips,snapshot);
});
test('empty travel summaries keep each expandable category available without synthetic records',()=>{
  for(const groups of [domesticFootprintGroups([],[],today),overseasFootprintGroups([],today)]){
    assert.deepEqual(groups.map(group=>group.id),['regions','cities','journeys']);
    assert(groups.every(group=>group.count===0&&group.items.length===0&&group.empty));
  }
});
