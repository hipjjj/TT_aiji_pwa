export type Counts = {
    homework: number;
    dictation: number;
    prep: number;
};
export type Quota = {
    target: number;
    initial: number;
    deadline: string;
    mode: 'minimum' | 'exact';
};
export type Analysis = {
    goals: string[];
    vocabulary: string[];
    grammar: string[];
    consolidation: string[];
    extension: string[];
    lessons: number;
    note: string;
    sources: {
        materialId: string;
        page: number;
        quote: string;
    }[];
};
export type Unit = {
    id: string;
    title: string;
    from: number;
    to: number;
    printedFrom: string;
    lessons: number;
    analysis?: Analysis;
};
export type Material = {
    id: string;
    title: string;
    role: 'primary' | 'auxiliary';
    fingerprint?: string;
    primaryId: string;
    pages: {
        number: number;
        text: string;
        bold: string[];
    }[];
    units: Unit[];
    createdAt: number;
};
export type Term = {
    id: string;
    title: string;
    startDate: string;
    weeks: number;
};
export type ClassRoom = {
    id: string;
    name: string;
    termId: string;
    materialId: string;
    weeklyLessons: number;
    lessonMinutes: number;
    schedule: {
        weekday: number;
        periods: number;
        time: string;
    }[];
    exceptions: {
        date: string;
        lessons: number;
        note: string;
    }[];
    overrides: {
        week: number;
        lessons: number;
    }[];
    exams: {
        id: string;
        title: string;
        date: string;
        unitIds: string[];
        detail: string;
        review: number;
        occupied: number;
    }[];
    buffer: number;
    unitIds: string[];
    quotas: Record<keyof Counts, Quota>;
    sharedPrep: boolean;
    coveredLessons?: string[];
};
export type Lesson = {
    id: string;
    unitId: string;
    title: string;
    content: string;
    source: string;
};
export type WeekPlan = {
    week: number;
    start: string;
    end: string;
    capacity: number;
    review: number;
    buffer: number;
    lessons: Lesson[];
    counts: Counts;
    note: string;
    locked: boolean;
};
export type Plan = {
    id: string;
    classId: string;
    createdAt: number;
    weeks: WeekPlan[];
    warnings: string[];
};
export type Progress = {
    id: string;
    classId: string;
    week: number;
    lessons: number;
    completed: string[];
    consolidation: string;
    note: string;
    counts: Counts;
};
export type PrepProgress = {
    id: string;
    groupId: string;
    week: number;
    count: number;
};
export type TeachingState = {
    version: 1;
    materials: Material[];
    terms: Term[];
    classes: ClassRoom[];
    plans: Plan[];
    progress: Progress[];
    prepProgress: PrepProgress[];
};
