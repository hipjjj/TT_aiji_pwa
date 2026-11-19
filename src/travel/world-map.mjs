// A world overview keeps both hemispheres in one map, including the dateline.
export function worldMapPoint(point) {
  const [longitude, latitude] = point;
  return [
    16 + ((Math.max(-180, Math.min(180, longitude)) + 180) / 360) * 588,
    73 + ((90 - Math.max(-90, Math.min(90, latitude))) / 180) * 294,
  ];
}
