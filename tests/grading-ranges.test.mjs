import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeRangePoints,
  pointsToRanges,
  validateGradingSettings,
  gradeExam,
} from "../src/grading/model.mjs";
test("explicit range inputs cover every question and support single questions and decimal marks", () => {
  assert.deepEqual(
    makeRangePoints(5, [
      { from: 1, to: 2, points: 0.5 },
      { from: 3, to: 3, points: 3.25 },
      { from: 4, to: 5, points: 2 },
    ]),
    [0.5, 0.5, 3.25, 2, 2],
  );
  assert.deepEqual(
    makeRangePoints(3, [
      { from: 3, to: 3, points: 2 },
      { from: 1, to: 2, points: 1 },
    ]),
    [1, 1, 2],
  );
});
test("there is no default score: gaps, overlap, invalid bounds and empty scores are refused", () => {
  const r = (from, to, points) => ({ from, to, points });
  for (const ranges of [
    [],
    [r(1, 2, 1)],
    [r(1, 3, 1), r(2, 2, 2)],
    [r(3, 1, 1)],
    [r(0, 3, 1)],
    [r(1, 4, 1)],
    [r(1, 3, 0)],
    [r(1, 3, 1.234)],
    [r(1, 3, NaN)],
  ])
    assert.throws(() => makeRangePoints(3, ranges));
  assert.throws(
    () => makeRangePoints(3, [r(1, 1, 1), r(3, 3, 1)]),
    /第2题尚未设置分值/,
  );
});
test("old per-question settings coalesce adjacent equal marks without changing totals or history snapshots", () => {
  const old = [1, 1, 2.5, 2.5, 1, 0.75, 0.75];
  const ranges = pointsToRanges(old);
  assert.deepEqual(ranges, [
    { from: 1, to: 2, points: 1 },
    { from: 3, to: 4, points: 2.5 },
    { from: 5, to: 5, points: 1 },
    { from: 6, to: 7, points: 0.75 },
  ]);
  assert.deepEqual(makeRangePoints(old.length, ranges), old);
  assert.deepEqual(old, [1, 1, 2.5, 2.5, 1, 0.75, 0.75]);
  const settings = validateGradingSettings({
    id: "main",
    title: "旧卷",
    questionCount: old.length,
    key: Array(old.length).fill("A"),
    points: old,
    updatedAt: 1,
  });
  const answers = old.map((_, i) => ({
    number: i + 1,
    answer: "A",
    confidence: "high",
    confirmed: false,
    note: "",
  }));
  assert.equal(gradeExam(settings, answers).total, 9.5);
  const distinct = Array.from({ length: 100 }, (_, i) => (i + 1) / 100);
  assert.deepEqual(makeRangePoints(100, pointsToRanges(distinct)), distinct);
});
