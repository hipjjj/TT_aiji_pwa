const integer = (x, min, max, label) => {
  if (!Number.isSafeInteger(x) || x < min || x > max)
    throw Error(label + "无效");
  return x;
};
const text = (x, max, label) => {
  if (typeof x !== "string" || x.length > max) throw Error(label + "无效");
  return x.trim();
};
export const choiceLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
export function parseAnswerKey(value, count) {
  integer(count, 1, 100, "题数");
  const input = text(value, 4000, "标准答案").normalize("NFKC").toUpperCase();
  let key;
  if (/^[A-H\s,，、;；]+$/.test(input)) {
    key = input.replace(/[^A-H]/g, "").split("");
  } else {
    key = Array(count).fill(null);
    const pattern = /(?:第\s*)?(\d{1,3})\s*(?:题)?\s*[.、:：)=-]?\s*([A-H])/g;
    const residue = input.replace(pattern, (_, number, answer) => {
      const n = Number(number);
      if (n < 1 || n > count || key[n - 1])
        throw Error("答案题号重复或超出题数");
      key[n - 1] = answer;
      return "";
    });
    if (residue.replace(/[\s,，、;；]+/g, ""))
      throw Error("标准答案请使用A–H单选答案，如1.A 2.B，或直接输入ABCD");
  }
  if (key.length !== count || key.some((x) => !choiceLetters.includes(x)))
    throw Error(`请提供全部${count}题的标准答案`);
  return key;
}
export function makePoints(count, defaultPoints, rules) {
  integer(count, 1, 100, "题数");
  const valid = (x) => {
    if (
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      x <= 0 ||
      x > 100 ||
      Math.abs(x * 100 - Math.round(x * 100)) > 1e-7
    )
      throw Error("每题分值须大于0、不超过100，最多两位小数");
    return x;
  };
  const points = Array(count).fill(valid(defaultPoints)),
    assigned = new Set();
  for (const line of text(rules, 4000, "分值设置")
    .split(/[\n,，;；]+/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const match =
      /^(\d{1,3})(?:\s*[-–—~～至]\s*(\d{1,3}))?\s*题?\s*[:：=]\s*(\d+(?:\.\d{1,2})?)\s*分?$/.exec(
        line,
      );
    if (!match) throw Error("分值规则请写成1-10:2，或11:3，每行一条");
    const from = Number(match[1]),
      to = Number(match[2] || match[1]),
      value = valid(Number(match[3]));
    if (from < 1 || to > count || from > to)
      throw Error("分值规则题号超出范围");
    for (let n = from; n <= to; n++) {
      if (assigned.has(n)) throw Error("分值规则题号重叠，请检查");
      assigned.add(n);
      points[n - 1] = value;
    }
  }
  return points;
}
export function validateGradingSettings(x) {
  if (!x || x.id !== "main") throw Error("批阅设置无效");
  const questionCount = integer(x.questionCount, 1, 100, "题数");
  if (
    !Array.isArray(x.key) ||
    x.key.length !== questionCount ||
    x.key.some((a) => !choiceLetters.includes(a)) ||
    !Array.isArray(x.points) ||
    x.points.length !== questionCount
  )
    throw Error("答案或分值与题数不一致");
  const points = x.points.map((p) => makePoints(1, p, "")[0]);
  return {
    id: "main",
    title: text(x.title, 100, "试卷名称"),
    questionCount,
    key: [...x.key],
    points,
    updatedAt: integer(x.updatedAt, 0, Number.MAX_SAFE_INTEGER, "更新时间"),
  };
}
export function validateExamPhoto(photo) {
  if (
    typeof photo !== "string" ||
    photo.length > 2800000 ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)
  )
    throw Error("试卷图片格式无效或过大，请使用JPG、PNG或WebP");
  const head = atob(photo.split(",")[1].slice(0, 32));
  if (
    (photo.startsWith("data:image/jpeg") && !head.startsWith("\xff\xd8\xff")) ||
    (photo.startsWith("data:image/png") &&
      !head.startsWith("\x89PNG\r\n\x1a\n")) ||
    (photo.startsWith("data:image/webp") &&
      !(head.startsWith("RIFF") && head.slice(8, 12) === "WEBP"))
  )
    throw Error("试卷图片内容无效");
  return photo;
}
export function validateExamRequest(x) {
  return {
    questionCount: integer(x?.questionCount, 1, 100, "题数"),
    photo: validateExamPhoto(x?.photo),
  };
}
export function validateExamRecognition(x, count) {
  integer(count, 1, 100, "题数");
  if (!x || !Array.isArray(x.answers) || x.answers.length > count)
    throw Error("AI识别结果无效");
  const seen = new Set();
  const found = x.answers.map((row) => {
    const number = integer(row.number, 1, count, "题号");
    if (seen.has(number)) throw Error("AI返回了重复题号，请重试");
    seen.add(number);
    if (
      ![...choiceLetters, "", "?"].includes(row.answer) ||
      !["high", "medium", "low"].includes(row.confidence)
    )
      throw Error("AI作答或置信度无效");
    return {
      number,
      answer: row.answer,
      confidence: row.confidence,
      note: text(row.note, 300, "识别说明"),
      confirmed: false,
    };
  });
  return {
    answers: Array.from(
      { length: count },
      (_, i) =>
        found.find((x) => x.number === i + 1) || {
          number: i + 1,
          answer: "?",
          confidence: "low",
          note: "照片中未能识别此题，请核对。",
          confirmed: false,
        },
    ),
    note: text(x.note, 1000, "识别备注"),
  };
}
export function gradeExam(settings, answers) {
  const config = validateGradingSettings(settings);
  if (!Array.isArray(answers) || answers.length !== config.questionCount)
    throw Error("作答数量与设置不一致");
  let earnedCents = 0,
    totalCents = 0,
    pending = 0,
    correct = 0;
  const rows = answers.map((row, i) => {
    if (
      row.number !== i + 1 ||
      ![...choiceLetters, "", "?"].includes(row.answer) ||
      !["high", "medium", "low"].includes(row.confidence) ||
      typeof row.confirmed !== "boolean"
    )
      throw Error("作答数据无效");
    const cents = Math.round(config.points[i] * 100);
    totalCents += cents;
    const needsReview =
      row.answer === "?" || (!row.confirmed && row.confidence !== "high");
    const status = needsReview
      ? "pending"
      : row.answer === config.key[i]
        ? "correct"
        : "wrong";
    if (needsReview) pending++;
    if (status === "correct") {
      correct++;
      earnedCents += cents;
    }
    return {
      number: i + 1,
      answer: row.answer,
      key: config.key[i],
      points: config.points[i],
      status,
    };
  });
  return {
    rows,
    earned: earnedCents / 100,
    total: totalCents / 100,
    pending,
    correct,
    wrong: rows.length - pending - correct,
  };
}
export function validateExamRecord(x) {
  if (!x || typeof x.id !== "string" || !x.id || x.id.length > 100)
    throw Error("批阅记录编号无效");
  const settings = validateGradingSettings(x.settings);
  gradeExam(settings, x.answers);
  const answers = x.answers.map((row) => ({
    number: row.number,
    answer: row.answer,
    confidence: row.confidence,
    confirmed: row.confirmed,
    note: text(row.note, 300, "识别说明"),
  }));
  return {
    id: x.id,
    title: text(x.title, 100, "批阅标题"),
    settings,
    answers,
    note: text(x.note, 1000, "批阅备注"),
    photo: x.photo === null ? null : validateExamPhoto(x.photo),
    createdAt: integer(x.createdAt, 0, Number.MAX_SAFE_INTEGER, "批阅时间"),
  };
}
export function validateGradingBackup(data) {
  if (data.grading === undefined) return null;
  const x = data.grading;
  if (
    !x ||
    !Array.isArray(x.records) ||
    x.records.length > 10000 ||
    typeof x.photosIncluded !== "boolean"
  )
    throw Error("试卷批阅备份无效");
  const records = x.records.map(validateExamRecord);
  if (new Set(records.map((x) => x.id)).size !== records.length)
    throw Error("批阅备份编号重复");
  return {
    records,
    settings: x.settings === null ? null : validateGradingSettings(x.settings),
    photosIncluded: x.photosIncluded,
  };
}

export function makeRangePoints(count, ranges) {
  integer(count, 1, 100, "题数");
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 100)
    throw Error("请至少填写一个计分区间，最多100个");
  const points = Array(count).fill(null);
  for (const range of ranges) {
    const from = integer(range?.from, 1, count, "题目A"),
      to = integer(range?.to, 1, count, "题目B");
    if (from > to) throw Error("题目A不能大于题目B");
    const score = makePoints(1, range.points, "")[0];
    for (let n = from; n <= to; n++) {
      if (points[n - 1] !== null) throw Error(`第${n}题的计分区间重叠，请检查`);
      points[n - 1] = score;
    }
  }
  const missing = points.findIndex((p) => p === null);
  if (missing >= 0)
    throw Error(`第${missing + 1}题尚未设置分值，请补齐所有题目的计分区间`);
  return points;
}
export function pointsToRanges(points) {
  if (!Array.isArray(points) || !points.length || points.length > 100)
    throw Error("原计分设置无效");
  const ranges = [];
  points.forEach((p, index) => {
    makePoints(1, p, "");
    const previous = ranges.at(-1);
    if (previous && previous.points === p) previous.to = index + 1;
    else ranges.push({ from: index + 1, to: index + 1, points: p });
  });
  return ranges;
}
