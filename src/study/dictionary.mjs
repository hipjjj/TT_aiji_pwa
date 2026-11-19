export function normalizeWord(word) {
  return String(word).normalize('NFKC').trim().replace(/[’‘]/g,"'").toLowerCase();
}
export function dictionaryBucket(word) {
  let hash=0;
  for(const char of word)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return String(hash%64).padStart(2,'0');
}
export function savedWord(words,word) {
  const key=normalizeWord(word);
  return words.filter(row=>normalizeWord(row.word)===key).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
}
/** Load only the required shard; bound parsed dictionaries held in memory. */
export function createDictionary(loadChunk) {
  const chunks=new Map();
  async function entry(word) {
    const key=dictionaryBucket(word);
    if(!chunks.has(key)) {
      const pending=Promise.resolve().then(()=>loadChunk(key));
      chunks.set(key,pending);
      pending.catch(()=>{if(chunks.get(key)===pending)chunks.delete(key);});
    }
    const pending=chunks.get(key);
    chunks.delete(key);chunks.set(key,pending);
    while(chunks.size>4)chunks.delete(chunks.keys().next().value);
    const chunk=await pending;
    return Object.hasOwn(chunk,word)?chunk[word]:null;
  }
  return async function lookup(raw,words=[]) {
    const word=normalizeWord(raw),saved=savedWord(words,word);
    if(saved?.meaning?.trim())return {word,lemma:'',meaning:saved.meaning,phonetic:'',source:'note'};
    if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word))return null;
    const value=await entry(word);
    if(!value)return null;
    const [meaning,phonetic,root]=value;
    const lemma=root&&root!==word&&/^[a-z]+(?:['-][a-z]+)*$/.test(root)?root:'';
    const base=lemma?await entry(lemma):null;
    const definition=base?.[0]?[meaning,`${lemma}：${base[0]}`].filter(Boolean).join('\n'):meaning;
    return definition?{word,lemma,meaning:definition.slice(0,300),phonetic:phonetic||base?.[1]||'',source:'ecdict'}:null;
  };
}
/** Preserve existing vocabulary IDs and mastery when saving a new definition. */
export function collectWord(state,{word,meaning,context,articleId},now=Date.now()) {
  const key=normalizeWord(word),old=savedWord(state.words,key);
  const row={...old,id:old?.id||key,word:old?.word||key,meaning:meaning.trim().slice(0,300),context,articleId,mastered:old?.mastered===true,updatedAt:now};
  return {...state,words:old?state.words.map(item=>item.id===old.id?row:item):[...state.words,row]};
}
