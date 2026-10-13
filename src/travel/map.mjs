const mercator = (point) => [
  (point[0] * Math.PI) / 180,
  -Math.log(
    Math.tan(
      Math.PI / 4 + (Math.max(-80, Math.min(80, point[1])) * Math.PI) / 360,
    ),
  ),
];
export function geometryPolygons(geometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}
export function splitGeometry(geometry) {
  const main = [],
    inset = [];
  for (const polygon of geometryPolygons(geometry)) {
    const ring = polygon[0];
    const latitude =
      ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    (latitude < 18 ? inset : main).push(polygon);
  }
  return {
    main: { type: "MultiPolygon", coordinates: main },
    inset: { type: "MultiPolygon", coordinates: inset },
  };
}
export function mapProjection(
  features,
  width = 620,
  height = 440,
  padding = 26,
) {
  const points = features.flatMap((feature) =>
    geometryPolygons(feature.geometry).flatMap((polygon) =>
      polygon.flatMap((ring) => ring.map(mercator)),
    ),
  );
  if (!points.length) return (point) => [width / 2, height / 2];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(
    (width - padding * 2) / (maxX - minX || 1),
    (height - padding * 2) / (maxY - minY || 1),
  );
  const dx = (width - (maxX - minX) * scale) / 2,
    dy = (height - (maxY - minY) * scale) / 2;
  return (point) => {
    const p = mercator(point);
    return [(p[0] - minX) * scale + dx, (p[1] - minY) * scale + dy];
  };
}
export function geometryPath(geometry, project) {
  return geometryPolygons(geometry)
    .map((polygon) =>
      polygon
        .map(
          (ring) =>
            ring
              .map((point, index) => {
                const [x, y] = project(point);
                return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(" ") + "Z",
        )
        .join(" "),
    )
    .join(" ");
}
export function mapLabels(features, project) {
  const boxes = [];
  return features
    .map((feature) => {
      const [x, y] = project(feature.properties.center),
        name = feature.properties.name.replace(
          /特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市$/g,
          "",
        );
      const width = Math.min(90, name.length * 12);
      const box = { x: x - width / 2, y: y - 6, w: width, h: 14 };
      const overlaps = boxes.some(
        (other) =>
          Math.abs(box.x + box.w / 2 - other.x - other.w / 2) <
            (box.w + other.w) / 2 + 3 && Math.abs(box.y - other.y) < 17,
      );
      if (overlaps) return null;
      boxes.push(box);
      return {
        id: feature.properties.id,
        name: name.length > 6 ? name.slice(0, 5) + "…" : name,
        x,
        y,
      };
    })
    .filter(Boolean);
}
