// Synthetic text only: exercises realistic unit length and PDF typography without
// publishing or sending any user's textbook, class settings or personal records.
export function teachingSmokeRequest(){
  const passage='Emma’s holiday was full of small discoveries. She visited a farm with her family last weekend.\nThey picked apples, fed sheep, and talked with a farmer. Emma didn’t buy anything expensive .\nHer brother’s favourite activity was walking beside the river. They were tired but happy.\nAsk students where Emma went, what she did, and how she felt. Practise short answers before retelling.\n';
  const notes='本单元围绕假期经历，复习一般过去时。基础练习先辨认时间词，再练习常见动词过去式。\n词汇建议：holiday 假期；visit 参观；farm 农场；discover 发现；tired 疲倦的。\n基础薄弱的班级可先用句型支架回答地点、活动和感受，再做短句复述；拓展任务由教师选用。\n';
  return {unitTitle:'Happy Holiday',materials:[
    {id:'synthetic-book',title:'Synthetic English unit',role:'primary',pages:Array.from({length:10},(_,i)=>({number:10+i,text:`Unit 1 · Happy Holiday\nSection ${i<5?'A':'B'} · PDF page ${10+i}\n`+passage.repeat(6)+'\nGrammar: past tense. Vocabulary: holiday, farm, visit, river, tired.\n',bold:[]}))},
    {id:'synthetic-notes',title:'Synthetic supplementary notes',role:'auxiliary',pages:Array.from({length:6},(_,i)=>({number:1+i,text:`Unit 1 · 辅助知识清单\n第${i+1}页\n`+notes.repeat(6),bold:[]}))},
    {id:'synthetic-plan',title:'Synthetic uploaded lesson plan',role:'lessonPlan',format:'docx',lessonRanges:Array.from({length:3},(_,i)=>({unitId:'unit-1',lessonFrom:i+1,lessonTo:i+1,from:i+1,to:i+1,title:`Period ${i+1}`})),pages:[{number:1,text:'Unit 1. Period 1. Begin by sharing holiday photos. Use where and what question cards. Let pairs practise short past-tense answers before a whole-class recap.',bold:[]},{number:2,text:'Unit 1. Period 2. Read the farm story. Let students sort event cards, locate past-tense verbs, and retell the events with sentence frames.',bold:[]},{number:3,text:'Unit 1. Period 3. Review core holiday words through a short dictation. Guide students to write three sentences about a familiar holiday and check the past tense in pairs.',bold:[]}]},
  ]};
}
