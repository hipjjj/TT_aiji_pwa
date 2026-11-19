import type { CSSProperties } from 'react';
import atlas from '../assets/penguin-family-transparent.webp';
import details from '../assets/home-details.webp';
import hallArt from '../assets/hall-family-work.webp';

export const family = ['鲍比', '小包', '嘟嘟糕', '黏黏包', '邪恶包', '羊羊包'] as const;
export type CharacterName = typeof family[number];
export function Character({name, className = ''}:{name:CharacterName; className?:string}) {
  const index = family.indexOf(name);
  return <span role="img" aria-label={name} data-character={name} className={`character ${className}`} style={{'--character-atlas':`url(${atlas})`, backgroundPosition:`${index % 3 * 50}% ${index < 3 ? 0 : 100}%`} as CSSProperties}/>;
}
export function Family({className=''}:{className?:string}) {
  return <span role="img" className={`family-portrait ${className}`} aria-label="鲍比、小包、嘟嘟糕、黏黏包和两只小企鹅邪恶包、羊羊包" style={{backgroundImage:`url(${hallArt})`,backgroundSize:'300% 100%',backgroundPosition:'0 0'}}/>;
}
export function Biao(){return <span role="img" aria-label="彪彪" className="biao-portrait" style={{backgroundImage:`url(${hallArt})`,backgroundSize:'300% 100%',backgroundPosition:'50% 0'}}/>;}
export function WorkPair(){return <span role="img" aria-label="邪恶包和羊羊包一起核对清单" className="work-pair" style={{backgroundImage:`url(${hallArt})`}}/>;}
export function ReadingArt(){return <span role="img" aria-label="企鹅依偎在一起读书" className="reading-art" style={{backgroundImage:`url(${details})`}}/>;}
