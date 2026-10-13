export type TravelPhoto = { id: string; dataURL: string; caption: string };
export type TravelSpot = {
  name: string;
  grade: "5A" | "4A" | "其他";
  catalogId?: string;
};
export type TravelStop = { cityId: string; spots: TravelSpot[] };
export type Trip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  stops: TravelStop[];
  note: string;
  photos: TravelPhoto[];
  story: string;
  storySource: "manual" | "template" | "ai";
  updatedAt: number;
};
export type VisitedCity = {
  cityId: string;
  date: string | null;
  note: string;
  updatedAt: number;
};
export type TravelCity = {
  id: string;
  name: string;
  provinceId: string;
  center: number[];
  type: string;
};
export type TravelProvince = {
  id: string;
  name: string;
  center: number[];
  cityIds: string[];
  wholeRegion: boolean;
  boundaryNote: string;
};
export type Scenic = {
  id: string;
  cityId: string;
  name: string;
  grade: "5A" | "4A";
  source: string;
  sourceURL: string;
  snapshot: string;
  sourceDate?: string;
  license: string;
};
export type MapFeature = {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    center: number[];
    provinceId?: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};
export type TravelMap = {
  type: "FeatureCollection";
  features: MapFeature[];
  outline?: MapFeature["geometry"];
};
export type UserScenic = {
  id: string;
  cityId: string;
  name: string;
  grade: "5A" | "4A" | "其他";
  sourceURL: string;
  updatedAt: number;
};
