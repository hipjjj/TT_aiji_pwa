import React, { lazy, Suspense, useState } from 'react';
import './style.css';
const Grading = lazy(() => import('../grading/GradingTab'));
const Teaching = lazy(() => import('./TeachingRoom'));
export default function WorkRoom({ onManageAI }: {
    onManageAI: () => void;
}) { const [view, setView] = useState<'teaching' | 'grading'>('teaching'); return <><div className="teaching teach-tabs teach-work-tabs" role="group" aria-label="工作功能"><button aria-pressed={view === 'teaching'} onClick={() => setView('teaching')}>教学进度</button><button aria-pressed={view === 'grading'} onClick={() => setView('grading')}>试卷批阅</button></div><Suspense fallback={<p className="empty">正在打开工作手册…</p>}>{view === 'teaching' ? <Teaching onManageAI={onManageAI}/> : <Grading onManageAI={onManageAI}/>}</Suspense></>; }
