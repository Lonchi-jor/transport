export type Point = { x: number; y: number };

const MAX_DETECT = 420;
const MAX_OUTPUT = 1600;

export function defaultQuad(width: number, height: number): Point[] {
  const insetX = width * 0.08;
  const insetY = height * 0.08;
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ];
}

export async function loadImageElement(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image illisible"));
    image.src = url;
  });
  return image;
}

export function imageToCanvas(image: HTMLImageElement, maxSide = 2400): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function detectDocumentQuad(imageData: ImageData): Point[] | null {
  const { width, height, data } = imageData;
  const scale = Math.min(1, MAX_DETECT / Math.max(width, height));
  const dw = Math.max(32, Math.round(width * scale));
  const dh = Math.max(32, Math.round(height * scale));
  const gray = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const i = (sy * width + sx) * 4;
      gray[y * dw + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  blurInPlace(gray, dw, dh);
  const mag = sobelMagnitude(gray, dw, dh);
  const binary = otsuBinary(mag, 0.55);
  dilate(binary, dw, dh);
  const blob = largestComponent(binary, dw, dh);
  if (!blob || blob.count < dw * dh * 0.04) return null;
  const hull = convexHull(blob.edge);
  if (hull.length < 4) return null;
  const quad = approxQuad(hull, Math.hypot(dw, dh));
  if (!quad) return null;
  const ordered = orderQuad(quad);
  const mapped = ordered.map((p) => ({
    x: clamp(p.x / scale, 0, width - 1),
    y: clamp(p.y / scale, 0, height - 1),
  }));
  const area = quadArea(mapped);
  if (area < width * height * 0.08) return null;
  return mapped;
}

export function warpDocumentColor(source: ImageData, quad: Point[]): ImageData {
  const ordered = orderQuad(quad);
  const { width: outW, height: outH } = outputSize(ordered);
  const dest: Point[] = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const H = homography(dest, ordered);
  const out = new ImageData(outW, outH);
  const src = source.data;
  const sw = source.width;
  const sh = source.height;
  const dst = out.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyHomography(H, x, y);
      const sample = bilinear(src, sw, sh, p.x, p.y);
      const i = (y * outW + x) * 4;
      dst[i] = sample[0];
      dst[i + 1] = sample[1];
      dst[i + 2] = sample[2];
      dst[i + 3] = 255;
    }
  }
  enhanceColorScan(out);
  return out;
}

export async function imageDataToJpegBlob(imageData: ImageData, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas indisponible"));
      return;
    }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage JPEG impossible"))),
      "image/jpeg",
      quality,
    );
  });
}

function enhanceColorScan(image: ImageData) {
  const { data } = image;
  const n = data.length / 4;
  const lum: number[] = new Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const sorted = lum.slice().sort((a, b) => a - b);
  const whiteL = sorted[Math.floor(n * 0.97)] || 255;
  const blackL = sorted[Math.floor(n * 0.04)] || 0;
  let wr = 0;
  let wg = 0;
  let wb = 0;
  let wc = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (lum[p] >= whiteL * 0.92) {
      wr += data[i];
      wg += data[i + 1];
      wb += data[i + 2];
      wc += 1;
    }
  }
  const whiteR = wc ? wr / wc : 255;
  const whiteG = wc ? wg / wc : 255;
  const whiteB = wc ? wb / wc : 255;
  const range = Math.max(18, whiteL - blackL);
  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] / whiteR) * 255;
    let g = (data[i + 1] / whiteG) * 255;
    let b = (data[i + 2] / whiteB) * 255;
    r = ((r - blackL) / range) * 255;
    g = ((g - blackL) / range) * 255;
    b = ((b - blackL) / range) * 255;
    r = (r - 128) * 1.12 + 128;
    g = (g - 128) * 1.12 + 128;
    b = (b - 128) * 1.12 + 128;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const gray = (max + min) / 2;
    const satBoost = 1.08;
    r = gray + (r - gray) * satBoost;
    g = gray + (g - gray) * satBoost;
    b = gray + (b - gray) * satBoost;
    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }
}

function outputSize(quad: Point[]) {
  const width = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  const height = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const scale = Math.min(1, MAX_OUTPUT / Math.max(width, height));
  return {
    width: Math.max(400, Math.round(width * scale)),
    height: Math.max(560, Math.round(height * scale)),
  };
}

function homography(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const X = dst[i].x;
    const Y = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solve(A, b);
  return [...h, 1];
}

function applyHomography(H: number[], x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col] || 1e-12;
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

function bilinear(src: Uint8ClampedArray, w: number, h: number, x: number, y: number): [number, number, number] {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) {
    const cx = clamp(Math.round(x), 0, w - 1);
    const cy = clamp(Math.round(y), 0, h - 1);
    const i = (cy * w + cx) * 4;
    return [src[i], src[i + 1], src[i + 2]];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return [0, 1, 2].map((c) =>
    mix(mix(src[i00 + c], src[i10 + c], fx), mix(src[i01 + c], src[i11 + c], fx), fy),
  ) as [number, number, number];
}

function blurInPlace(gray: Float32Array, w: number, h: number) {
  const tmp = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -2; k <= 2; k++) {
        const xx = clamp(x + k, 0, w - 1);
        s += gray[y * w + xx];
        c += 1;
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -2; k <= 2; k++) {
        const yy = clamp(y + k, 0, h - 1);
        s += tmp[yy * w + x];
        c += 1;
      }
      gray[y * w + x] = s / c;
    }
  }
}

function sobelMagnitude(gray: Float32Array, w: number, h: number) {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function otsuBinary(mag: Float32Array, minKeep: number) {
  let max = 1;
  for (const v of mag) if (v > max) max = v;
  const hist = new Array(64).fill(0);
  for (const v of mag) hist[Math.min(63, Math.floor((v / max) * 63))] += 1;
  const total = mag.length;
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thresh = 18;
  for (let t = 0; t < 64; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thresh = t;
    }
  }
  const cut = (thresh / 63) * max * minKeep;
  const binary = new Uint8Array(mag.length);
  for (let i = 0; i < mag.length; i++) binary[i] = mag[i] >= cut ? 1 : 0;
  return binary;
}

function dilate(binary: Uint8Array, w: number, h: number) {
  const copy = binary.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (
        copy[y * w + x] ||
        copy[y * w + x - 1] ||
        copy[y * w + x + 1] ||
        copy[(y - 1) * w + x] ||
        copy[(y + 1) * w + x]
      ) {
        binary[y * w + x] = 1;
      }
    }
  }
}

function largestComponent(binary: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(binary.length);
  let best: { count: number; edge: Point[] } | null = null;
  const qx: number[] = [];
  const qy: number[] = [];
  for (let start = 0; start < binary.length; start++) {
    if (!binary[start] || seen[start]) continue;
    qx.length = 0;
    qy.length = 0;
    qx.push(start % w);
    qy.push(Math.floor(start / w));
    seen[start] = 1;
    const edge: Point[] = [];
    let count = 0;
    let qi = 0;
    while (qi < qx.length) {
      const x = qx[qi];
      const y = qy[qi];
      qi += 1;
      count += 1;
      let border = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !binary[ny * w + nx]) {
          border = true;
          continue;
        }
        const ni = ny * w + nx;
        if (!seen[ni]) {
          seen[ni] = 1;
          qx.push(nx);
          qy.push(ny);
        }
      }
      if (border && edge.length < 2500) edge.push({ x, y });
    }
    if (!best || count > best.count) best = { count, edge };
  }
  return best;
}

function convexHull(points: Point[]): Point[] {
  const unique = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length < 3) return unique;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function approxQuad(hull: Point[], diag: number): Point[] | null {
  if (hull.length === 4) return hull;
  let epsilon = diag * 0.02;
  let best: Point[] | null = null;
  for (let i = 0; i < 18; i++) {
    const simplified = rdp(hull, epsilon);
    if (simplified.length === 4) return simplified;
    if (simplified.length > 4) best = pickFour(simplified);
    epsilon *= 1.22;
  }
  return best;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const closed = [...points, points[0]];
  const keep = rdpOpen(closed, epsilon);
  keep.pop();
  return keep;
}

function rdpOpen(points: Point[], epsilon: number): Point[] {
  let maxD = 0;
  let idx = 0;
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = rdpOpen(points.slice(0, idx + 1), epsilon);
    const right = rdpOpen(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function pickFour(points: Point[]): Point[] {
  let best: Point[] = points.slice(0, 4);
  let bestArea = 0;
  const n = points.length;
  if (n > 24) {
    const step = Math.ceil(n / 16);
    const sampled = points.filter((_, i) => i % step === 0);
    return pickFour(sampled.length >= 4 ? sampled : points.slice(0, 16));
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const q = [points[i], points[j], points[k], points[l]];
          const area = quadArea(orderQuad(q));
          if (area > bestArea) {
            bestArea = area;
            best = q;
          }
        }
      }
    }
  }
  return best;
}

function orderQuad(points: Point[]): Point[] {
  const sorted = [...points];
  sorted.sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = sorted[0];
  const br = sorted[sorted.length - 1];
  const rest = sorted.slice(1, -1);
  rest.sort((a, b) => a.y - a.x - (b.y - b.x));
  const tr = rest[0] ?? { x: br.x, y: tl.y };
  const bl = rest[rest.length - 1] ?? { x: tl.x, y: br.y };
  return [tl, tr, br, bl];
}

function perpDist(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function quadArea(q: Point[]) {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += q[i].x * q[j].y - q[j].x * q[i].y;
  }
  return Math.abs(area) / 2;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
