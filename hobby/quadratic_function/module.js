export function toFraction(num) {
  if (Number.isInteger(num)) return num.toString();

  const tolerance = 1e-10;
  let h1 = 1, h2 = 0;
  let k1 = 0, k2 = 1;
  let b = num;

  do {
    let a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;

    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;

    b = 1 / (b - a);
  } while (Math.abs(num - h1 / k1) > num * tolerance);

  // 分母が1なら整数
  if (k1 === 1) return h1.toString();

  return `${h1}/${k1}`;
}

export function formatQuadratic(a, p, q) {
  let str = "y = ";

  const A = toFraction(a);
  const P = toFraction(p);
  const Q = toFraction(q);

  // ===== p = 0 の特別処理 =====
  if (p === 0) {
    if (a === 1) {
      str += "x²";
    } else if (a === -1) {
      str += "-x²";
    } else {
      str += A + "x²";
    }
  } else {
    // ===== 通常 =====
    if (a === 1) {
      str += "(x ";
    } else if (a === -1) {
      str += "-(x ";
    } else {
      str += A + "(x ";
    }

    if (p > 0) {
      str += "- " + P + ")²";
    } else {
      str += "+ " + toFraction(Math.abs(p)) + ")²";
    }
  }

  // ===== q =====
  if (q > 0) {
    str += " + " + Q;
  } else if (q < 0) {
    str += " - " + toFraction(Math.abs(q));
  }

  return str;
}

export function fmt(num) {
  return toFraction(num);
}

export function formatPoints(points) {
  return points
    .map(p => `(${toFraction(p.x)}, ${toFraction(p.y)})`)
    .join("<br>");
}

export function convertToApq(type, a, b, c, p, q) {
  if (type === "abc") {
    return {
      a,
      p: -b / (2 * a),
      q: c - (b * b) / (4 * a)
    };
  }
  return { a, p, q };
}

export function createQuadratic(a, p, q) {
  return function (x) {
    return a * (x - p) ** 2 + q;
  };
}

export function calcExtrema(a, p, q, min, max) {

  const f = (x) => a * (x - p) ** 2 + q;

  let maxPoints = [];
  let minPoints = [];

  let yMinVal, yMaxVal;

  if (p >= min && p <= max) {

    if (a > 0) {
      // 最小は頂点
      yMinVal = f(p);
      minPoints = [{ x: p, y: yMinVal }];

      let y1 = f(min);
      let y2 = f(max);
      yMaxVal = Math.max(y1, y2);

      if (y1 === yMaxVal) maxPoints.push({ x: min, y: y1 });
      if (y2 === yMaxVal) maxPoints.push({ x: max, y: y2 });

    } else {
      // 最大は頂点
      yMaxVal = f(p);
      maxPoints = [{ x: p, y: yMaxVal }];

      let y1 = f(min);
      let y2 = f(max);
      yMinVal = Math.min(y1, y2);

      if (y1 === yMinVal) minPoints.push({ x: min, y: y1 });
      if (y2 === yMinVal) minPoints.push({ x: max, y: y2 });
    }

  } else {
    let y1 = f(min);
    let y2 = f(max);

    yMaxVal = Math.max(y1, y2);
    yMinVal = Math.min(y1, y2);

    if (y1 === yMaxVal) maxPoints.push({ x: min, y: y1 });
    if (y2 === yMaxVal) maxPoints.push({ x: max, y: y2 });

    if (y1 === yMinVal) minPoints.push({ x: min, y: y1 });
    if (y2 === yMinVal) minPoints.push({ x: max, y: y2 });
  }

  return { maxPoints, minPoints };
}

export function normalizeInput(a, b, c, p, q) {
  return {
    a: Number(a),
    b: Number(b || 0),
    c: Number(c || 0),
    p: Number(p || 0),
    q: Number(q || 0)
  };
}

export function drawGraph(a, p, q, min, max, maxPoints, minPoints) {

  const canvas = document.getElementById("graph");
  canvas.classList.remove("hidden");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  function f(x) {
    return a * (x - p) ** 2 + q;
  }

  // スケール
  const w = canvas.width;
  const h = canvas.height;

  let xs = [];
  for (let x = min; x <= max; x += (max - min) / 100) {
    xs.push({ x, y: f(x) });
  }

  const yMinRaw = Math.min(...xs.map(v => v.y));
  const yMaxRaw = Math.max(...xs.map(v => v.y));

  // 余白（10%）
  const margin = (yMaxRaw - yMinRaw) * 0.1 || 1;

  const yMinGraph = yMinRaw - margin;
  const yMaxGraph = yMaxRaw + margin;

  const xMargin = (max - min) * 0.05;

  function tx(x) {
    return (x - (min - xMargin)) / ((max + xMargin) - (min - xMargin)) * w;
  }

  function ty(y) {
    return h - (y - yMinGraph) / (yMaxGraph - yMinGraph) * h;
  }

  // ===== 整数グリッド =====
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;

  // x方向（縦線）
  for (let x = Math.ceil(min); x <= Math.floor(max); x++) {
    const px = tx(x);

    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }

  // y方向（横線）
  for (let y = Math.ceil(yMinGraph); y <= Math.floor(yMaxGraph); y++) {
    const py = ty(y);

    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
  }

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;

  // y=0（x軸）
  if (yMinGraph < 0 && yMaxGraph > 0) {
    const y0 = ty(0);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(canvas.width, y0);
    ctx.stroke();
  }

  // x=0（y軸）
  if (min < 0 && max > 0) {
    const x0 = tx(0);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = "10px sans-serif";

  // x軸ラベル
  for (let x = Math.ceil(min); x <= Math.floor(max); x++) {
    const px = tx(x);
    ctx.fillText(x, px + 2, canvas.height - 5);
  }

  // y軸ラベル
  for (let y = Math.ceil(yMinGraph); y <= Math.floor(yMaxGraph); y++) {
    const py = ty(y);
    ctx.fillText(y, 2, py - 2);
  }

  // 線
  ctx.beginPath();
  xs.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(tx(pt.x), ty(pt.y));
    else ctx.lineTo(tx(pt.x), ty(pt.y));
  });
  ctx.stroke();

  // 最大最小点
  // 最大値（赤）
  ctx.fillStyle = "red";
  maxPoints.forEach(pt => {
    ctx.beginPath();
    ctx.arc(tx(pt.x), ty(pt.y), 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 最小値（青）
  ctx.fillStyle = "blue";
  minPoints.forEach(pt => {
    ctx.beginPath();
    ctx.arc(tx(pt.x), ty(pt.y), 5, 0, Math.PI * 2);
    ctx.fill();
  });
}
