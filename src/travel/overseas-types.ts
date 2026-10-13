import type { TravelPhoto } from "./types";
export type OverseasStop = {
  countryCode: string;
  city: string;
  spots: string[];
};
export type OverseasTrip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  stops: OverseasStop[];
  note: string;
  photos: TravelPhoto[];
  story: string;
  storySource: "manual" | "template" | "ai";
  updatedAt: number;
};
