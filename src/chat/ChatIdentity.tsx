import {Character,Family} from '../home/Characters';
import type {ChatMode} from './types';

export default function ChatIdentity({mode}:{mode:ChatMode}) {
  return <><div className="chat-header-avatar">{mode==='群聊'?<Family/>:<Character name={mode}/>}</div><div className="chat-header-copy"><span>企鹅小家 · {mode==='群聊'?'大家一起聊':'悄悄话'}</span><h2>{mode==='群聊'?'企鹅家族':`和${mode}聊天`}</h2></div></>;
}
