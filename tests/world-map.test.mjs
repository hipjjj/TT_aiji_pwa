import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometryPath} from '../src/travel/map.mjs';
import {worldMapPoint} from '../src/travel/world-map.mjs';
import {countries,overseasFootprints} from '../src/travel/overseas-model.mjs';

const world=JSON.parse(readFileSync(new URL('../public/travel-maps/world.json',import.meta.url)));
test('offline world geometry and reference points cover overseas destinations with finite paths',()=>{
  assert.equal(world.features.length,177);
  assert.equal(new Set(world.features.map(f=>f.properties.id)).size,world.features.length);
  const places=new Map(world.places.map(p=>[p.code,p]));
  assert.equal(places.size,world.places.length);
  for(const country of countries){
    assert(places.has(country.code),country.code);
    const point=worldMapPoint(places.get(country.code).center);
    assert(point.every(Number.isFinite));
    assert(point[0]>=16&&point[0]<=604&&point[1]>=73&&point[1]<=367);
  }
  for(const feature of world.features){
    const path=geometryPath(feature.geometry,worldMapPoint);
    assert(path.startsWith('M'),feature.properties.id);
    assert(!/NaN|Infinity/.test(path),feature.properties.id);
  }
  assert(worldMapPoint([-74,41])[0]<worldMapPoint([2,49])[0]);
  assert(worldMapPoint([2,49])[0]<worldMapPoint([140,36])[0]);
});
test('completed overseas footprints join world shapes and small-island dots using existing country codes',()=>{
  const trips=[{endDate:'2026-10-03',stops:[{countryCode:'JP',city:'东京'},{countryCode:'FR',city:'巴黎'},{countryCode:'NO',city:'奥斯陆'},{countryCode:'SG',city:'新加坡'}]},
    {endDate:'2027-01-03',stops:[{countryCode:'US',city:'纽约'}]}];
  const footprints=overseasFootprints(trips,'2026-11-19');
  const shapes=new Set(world.features.map(f=>f.properties.id));
  const dots=new Set(world.places.filter(p=>!shapes.has(p.code)).map(p=>p.code));
  for(const code of ['JP','FR','NO'])assert(shapes.has(code),code);
  assert(dots.has('SG'));
  for(const code of footprints.countries.keys())assert(shapes.has(code)||dots.has(code),code);
  assert.deepEqual([...footprints.countries.get('JP')],['东京']);
  assert(!footprints.countries.has('US'));
});
