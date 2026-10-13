import type { AIAnalysis, MealType } from "../nutrition/types";
export type Penguin = "鲍比" | "小包" | "嘟嘟糕" | "黏黏包";
export type ChatMode = "群聊" | Penguin;
export type Proposal = {
  id: string;
  kind: "记忆" | "成长" | "账单" | "食材" | "购物" | "饮食";
  text: string;
  name: string;
  unit: string;
  quantity: string;
  category: string;
  date: string;
  location: string;
  memoryKind: string;
  cents: number;
  mealType?: MealType | "";
  foods?: AIAnalysis["foods"];
  status: "pending" | "accepted" | "dismissed";
};
export type ChatThread = {
  id: string;
  mode: ChatMode;
  title: string;
  updatedAt: number;
};
export type ChatMessage = {
  id: string;
  threadId: string;
  speaker: "用户" | Penguin;
  text: string;
  createdAt: number;
  proposals: Proposal[];
};
export type ChatMemory = {
  id: string;
  kind: "偏好" | "真实经历" | "家庭小剧场";
  text: string;
  updatedAt: number;
};
export type ChatGrowth = {
  id: "main";
  value: number;
  updatedAt: number;
  events: { at: number; text: string }[];
};
