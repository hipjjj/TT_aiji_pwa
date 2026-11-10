export type GradingSettings = {
  id: "main";
  title: string;
  questionCount: number;
  key: string[];
  points: number[];
  updatedAt: number;
};
export type ExamAnswer = {
  number: number;
  answer: string;
  confidence: "high" | "medium" | "low";
  note: string;
  confirmed: boolean;
};
export type ExamRecord = {
  id: string;
  title: string;
  settings: GradingSettings;
  answers: ExamAnswer[];
  note: string;
  photo: string | null;
  createdAt: number;
};
