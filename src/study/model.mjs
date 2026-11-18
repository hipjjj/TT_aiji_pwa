export const studyKey='study-state';
export const emptyStudy=()=>({articles:[],words:[],footprints:[]});
export const sampleArticle={id:'sample-huddle',title:'Why Do Penguins Huddle?',source:'示例文章 · 科普',text:`Winter in Antarctica is very cold. Strong winds blow across the ice. Emperor penguins have thick feathers and a layer of fat to keep them warm. But they have another way to stay comfortable: they huddle together.

A huddle is a large group of penguins standing close to one another. A penguin inside the group loses less heat than a penguin standing alone. Each bird helps protect its neighbours from the cold wind.

The penguins do not stand still all day. They take tiny steps, and the group slowly changes shape. Penguins near the outside gradually move into warmer places. Those inside also move. In this way, the birds share the warmth.

Huddling is especially important while male emperor penguins look after their eggs. They balance the eggs on their feet and cover them with a fold of skin. During this time, they cannot simply leave to find food. Saving energy helps them care for the next generation.

People can learn something from these birds. A small step may not seem important, but many small steps can change a whole group. Working together can help us through a difficult day.

Next time you feel cold, think of the penguins on the ice. They remind us that being close and caring for one another can make a difference.`};
export const dictionary={huddle:'挤在一起；聚成一团',penguin:'企鹅',penguins:'企鹅（复数）',winter:'冬天',cold:'寒冷的',warm:'温暖的',warmth:'温暖；暖意',feathers:'羽毛',neighbours:'邻居',energy:'能量',tiny:'极小的',gradually:'逐渐地',protect:'保护',comfortable:'舒适的',generation:'一代',balance:'使平衡',important:'重要的',together:'一起',wind:'风',winds:'风（复数）',share:'分享',thick:'厚的',heat:'热量',ice:'冰',group:'群体',slowly:'慢慢地',remind:'提醒',difference:'不同；影响',emperor:'皇帝；帝企鹅中的“帝”',eggs:'蛋（复数）',care:'照顾；关心',learn:'学习',reading:'阅读',article:'文章',daily:'每天的',record:'记录',journey:'旅程',friend:'朋友'};
const text=(value,max)=>{if(typeof value!=='string'||value.length>max)throw Error('学习资料文字格式无效');return value;};
export function validateStudy(value){
  if(!value||!Array.isArray(value.articles)||!Array.isArray(value.words)||!Array.isArray(value.footprints)||value.articles.length>100||value.words.length>2000||value.footprints.length>5000)throw Error('学习资料格式无效或超出容量');
  const checkRows=(rows,kind)=>{const ids=new Set();return rows.map(row=>{const id=text(row?.id,150);if(!id||ids.has(id))throw Error('学习资料编号重复或缺失');ids.add(id);if(!Number.isSafeInteger(row.updatedAt)||row.updatedAt<0)throw Error('学习资料日期无效');
    if(kind==='article')return {id,title:text(row.title,150),text:text(row.text,100000),source:text(row.source,200),updatedAt:row.updatedAt};
    if(kind==='word')return {id,word:text(row.word,100),meaning:text(row.meaning,300),context:text(row.context,1500),articleId:text(row.articleId,150),mastered:row.mastered===true,updatedAt:row.updatedAt};
    if(!Number.isFinite(row.minutes)||row.minutes<0||row.minutes>1440)throw Error('阅读时长无效');
    return {id,title:text(row.title,150),articleId:text(row.articleId,150),date:text(row.date,10),minutes:row.minutes,updatedAt:row.updatedAt};});};
  return {articles:checkRows(value.articles,'article'),words:checkRows(value.words,'word'),footprints:checkRows(value.footprints,'footprint')};
}
export function validateStudyBackup(data){return data.study===undefined?null:validateStudy(data.study);}
export function mergeStudy(current,incoming){const result={};for(const key of ['articles','words','footprints'])result[key]=[...new Map([...current[key],...incoming[key]].map(row=>[row.id,row])).values()];return validateStudy(result);}
