import {db} from '../db';
import {emptyStudy,studyKey,validateStudy} from './model.mjs';
export type Article={id:string;title:string;text:string;source:string;sourceUrl?:string;updatedAt?:number};
export type Word={id:string;word:string;meaning:string;context:string;articleId:string;mastered:boolean;updatedAt:number};
export type Footprint={id:string;title:string;articleId:string;date:string;minutes:number;updatedAt:number};
export type StudyData={articles:Article[];words:Word[];footprints:Footprint[]};
export async function readStudy():Promise<StudyData>{const row=await db.appMeta.get(studyKey);return row?validateStudy(JSON.parse(String(row.value))):emptyStudy();}
export async function changeStudy(change:(state:StudyData)=>StudyData):Promise<StudyData>{return db.transaction('rw',db.appMeta,async()=>{const state=validateStudy(change(await readStudy()));await db.appMeta.put({id:studyKey,value:JSON.stringify(state),updatedAt:Date.now()});return state;});}
