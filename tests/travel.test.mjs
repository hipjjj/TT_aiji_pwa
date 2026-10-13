import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cities,provinces,cityById,draftStory,storyPayload,validateStoryRequest,validateTrip,validateTravelBackup,validateUserScenic,visitedCityIds,visitedProvinceIds} from '../src/travel/model.mjs';
import {geometryPath,mapProjection,splitGeometry} from '../src/travel/map.mjs';
const trip=(overrides={})=>({id:'travel-1',title:'杭州与宁波的小旅行',startDate:'2026-10-01',endDate:'2026-10-03',stops:[{cityId:'330100',spots:[{name:'西湖',grade:'5A'}]},{cityId:'330200',spots:[]}],note:'走累了就慢慢休息。',photos:[],story:'',storySource:'manual',updatedAt:1,...overrides});
test('travel dataset has 34 provinces and unique, explicitly attributed travel regions and 373 mapped 5A records',()=>{
 assert.equal(provinces.length,34);assert.equal(cities.length,370);assert.equal(new Set(cities.map(city=>city.id)).size,cities.length);
 for(const province of provinces)for(const id of province.cityIds)assert.equal(cityById(id).provinceId,province.id);
 const catalog=JSON.parse(readFileSync(new URL('../src/travel/scenic.json',import.meta.url)));assert.equal(catalog.length,373);assert.equal(new Set(catalog.map(spot=>spot.id)).size,catalog.length);assert(catalog.every(spot=>spot.grade==='5A'&&cityById(spot.cityId)&&spot.license==='CC-BY-SA-4.0'&&spot.sourceDate==='2026-08-31'));
 assert.equal(cityById('110000').name,'北京市');assert.equal(provinces.find(p=>p.id==='110000').cityIds.length,1);
});
test('national and province map feature IDs match navigation metadata; finite projection preserves source island geometry in one viewport',()=>{
 const national=JSON.parse(readFileSync(new URL('../public/travel-maps/national.json',import.meta.url)));assert.equal(national.features.length,34);assert(national.outline);
 for(const province of provinces){const map=JSON.parse(readFileSync(new URL(`../public/travel-maps/${province.id}.json`,import.meta.url)));assert.deepEqual(map.features.map(feature=>feature.properties.id),province.cityIds);const project=mapProjection(map.features);for(const feature of map.features){const path=geometryPath(feature.geometry,project);assert(path.length>0);assert(!/NaN|Infinity/.test(path));}}
 const split=splitGeometry(national.features.find(feature=>feature.properties.id==='460000').geometry);assert(split.main.coordinates.length>0);assert(split.inset.coordinates.length>0);
});
test('trip validation rejects inverted dates, unknown or duplicate cities and unsafe photo sources',()=>{
 assert.equal(validateTrip(trip()).stops.length,2);assert.throws(()=>validateTrip(trip({endDate:'2026-09-30'})));assert.throws(()=>validateTrip(trip({stops:[{cityId:'unknown',spots:[]}]})));assert.throws(()=>validateTrip(trip({stops:[trip().stops[0],trip().stops[0]]})));assert.throws(()=>validateTrip(trip({photos:[{id:'p',dataURL:'https://remote.test/photo.jpg',caption:''}]})));
});
test('visited footprints derive from completed trips and independent manual marks; deleting trips does not delete manual marks',()=>{
 const manual=[{cityId:'110000',date:null,note:'小时候来过',updatedAt:1}];const visited=visitedCityIds([trip(),trip({id:'future',startDate:'2027-01-01',endDate:'2027-01-02',stops:[{cityId:'440100',spots:[]}]})],manual,'2026-10-13');assert.deepEqual([...visited].sort(),['110000','330100','330200']);assert.equal(visitedProvinceIds(visited).size,2);assert.deepEqual([...visitedCityIds([],manual,'2026-10-13')],['110000']);
});
test('travel backup preserves omission semantics and rejects damaged records before transaction; user ratings remain separately attributed',()=>{
 assert.equal(validateTravelBackup({version:1}),null);const backup={travel:{trips:[trip()],visitedCities:[],spots:[],photosIncluded:false}};assert.equal(validateTravelBackup(backup).photosIncluded,false);assert.throws(()=>validateTravelBackup({travel:{...backup.travel,trips:[trip(),trip()]}}));assert.throws(()=>validateUserScenic({id:'x',cityId:'330100',name:'景点',grade:'4A',sourceURL:'javascript:alert(1)',updatedAt:1}));
});
test('local story uses recorded facts; AI payload strips photos and other app data and validates output input lengths',()=>{
 const input=trip();const story=draftStory(input);assert.match(story,/杭州/);assert.match(story,/西湖/);assert.match(story,/走累了就慢慢休息/);assert(!/晴天|酒店|同行人/.test(story));const payload=storyPayload({...input,expense:'private',body:'private'});assert.equal(payload.stops[0].city,'杭州市');assert(!Object.hasOwn(payload,'photos'));assert(!JSON.stringify(payload).includes('private'));assert.throws(()=>validateStoryRequest({...payload,endDate:'2026-09-01'}));
});
