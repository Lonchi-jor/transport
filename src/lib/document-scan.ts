export type Point = { x: number; y: number };

const MAX_DETECT = 480;
const MAX_OUTPUT = 2000;

export function defaultQuad(width: number, height: number): Point[] {
  const insetX = width * 0.06;
  const insetY = height * 0.06;
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
  const dw = Math.max(48, Math.round(width * scale));
  const dh = Math.max(48, Math.round(height * scale));
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

  const candidates: { quad: Point[]; score: number }[] = [];
  const paper = detectFromPaper(gray, dw, dh);
  if (paper) candidates.push({ quad: paper, score: scoreQuad(paper, dw, dh) + 8 });
  const edges = detectFromEdges(gray, dw, dh);
  if (edges) candidates.push({ quad: edges, score: scoreQuad(edges, dw, dh) });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.find((c) => c.score > 0);
  if (!best) return null;

  const mapped = orderQuad(best.quad).map((p) => ({
    x: clamp(p.x / scale, 2, width - 3),
    y: clamp(p.y / scale, 2, height - 3),
  }));
  const refined = insetQuad(orderQuad(mapped), 0.01);
  if (scoreQuad(refined, width, height) <= 0) return orderQuad(mapped);
  return refined;
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

export async function imageDataToJpegBlob(imageData: ImageData, quality = 0.92): Promise<Blob> {
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

function luminancePercentile(gray: Float32Array, p: number) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    hist[Math.max(0, Math.min(255, Math.round(gray[i])))] += 1;
  }
  const target = gray.length * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 180;
}

function detectFromPaper(gray: Float32Array, w: number, h: number): Point[] | null {
  const hi = luminancePercentile(gray, 0.62);
  const binary = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) binary[i] = gray[i] >= hi ? 1 : 0;
  openBinary(binary, w, h);
  closeBinary(binary, w, h);
  const blob = largestComponent(binary, w, h, { ignoreBorderHeavy: true });
  if (!blob || blob.count < w * h * 0.12) return null;
  const hull = convexHull(blob.edge);
  if (hull.length < 4) return null;
  return minAreaRect(hull);
}

function detectFromEdges(gray: Float32Array, w: number, h: number): Point[] | null {
  const mag = sobelMagnitude(gray, w, h);
  const binary = otsuBinary(mag, 0.42);
  closeBinary(binary, w, h);
  dilate(binary, w, h);
  const blob = largestComponent(binary, w, h, { ignoreBorderHeavy: false });
  if (!blob || blob.count < w * h * 0.03) return null;
  const hull = convexHull(blob.edge);
  if (hull.length < 4) return null;
  return minAreaRect(hull);
}

function minAreaRect(hull: Point[]): Point[] | null {
  if (hull.length < 4) return null;
  let bestArea = Infinity;
  let best: Point[] | null = null;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of hull) {
      const x = p.x * cos + p.y * sin;
      const y = -p.x * sin + p.y * cos;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > 0 && area < bestArea) {
      bestArea = area;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      best = corners.map((p) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      }));
    }
  }
  return best ? orderQuad(best) : null;
}

function scoreQuad(quad: Point[], w: number, h: number) {
  const q = orderQuad(quad);
  const area = quadArea(q);
  const frame = w * h;
  if (area < frame * 0.1 || area > frame * 0.96) return 0;
  const top = dist(q[0], q[1]);
  const right = dist(q[1], q[2]);
  const bottom = dist(q[2], q[3]);
  const left = dist(q[3], q[0]);
  if (Math.min(top, right, bottom, left) < Math.min(w, h) * 0.12) return 0;
  const hRatio = Math.min(top, bottom) / Math.max(top, bottom);
  const vRatio = Math.min(left, right) / Math.max(left, right);
  const angles = [0, 1, 2, 3].map((i) => {
    const p = q[i];
    const prev = q[(i + 3) % 4];
    const next = q[(i + 1) % 4];
    const ax = prev.x - p.x;
    const ay = prev.y - p.y;
    const bx = next.x - p.x;
    const by = next.y - p.y;
    const den = Math.hypot(ax, ay) * Math.hypot(bx, by) || 1;
    const cos = clamp((ax * bx + ay * by) / den, -1, 1);
    const deg = (Math.acos(cos) * 180) / Math.PI;
    return 1 - Math.min(1, Math.abs(deg - 90) / 55);
  });
  const angleScore = angles.reduce((s, v) => s + v, 0) / 4;
  const aspect = Math.max(top, bottom) / Math.max(left, right);
  const aspectScore = aspect > 0.35 && aspect < 2.8 ? 1 : 0.45;
  return (area / frame) * 40 + hRatio * 18 + vRatio * 18 + angleScore * 24 + aspectScore * 8;
}

function insetQuad(q: Point[], ratio: number): Point[] {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => ({
    x: p.x + (cx - p.x) * ratio,
    y: p.y + (cy - p.y) * ratio,
  }));
}

function enhanceColorScan(image: ImageData) {
  flattenIllumination(image);
  const { data, width, height } = image;
  const n = data.length / 4;
  const lum = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) hist[Math.max(0, Math.min(255, Math.round(lum[p])))] += 1;
  const pick = (q: number) => {
    const target = n * q;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= target) return i;
    }
    return 255;
  };
  const blackL = pick(0.015);
  const whiteL = Math.max(blackL + 28, pick(0.97));
  let wr = 0;
  let wg = 0;
  let wb = 0;
  let wc = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (lum[p] >= whiteL * 0.9) {
      wr += data[i];
      wg += data[i + 1];
      wb += data[i + 2];
      wc += 1;
    }
  }
  const whiteR = Math.max(32, wc ? wr / wc : 255);
  const whiteG = Math.max(32, wc ? wg / wc : 255);
  const whiteB = Math.max(32, wc ? wb / wc : 255);
  const range = Math.max(32, whiteL - blackL);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let r = (data[i] / whiteR) * 255;
    let g = (data[i + 1] / whiteG) * 255;
    let b = (data[i + 2] / whiteB) * 255;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    let t = (y - blackL) / range;
    t = clamp(t, 0, 1.08);
    if (t > 0.58) t = 0.58 + (t - 0.58) * 1.85;
    if (t < 0.38) t *= 0.82;
    t = clamp(t, 0, 1);
    t = 1 / (1 + Math.exp(-(t - 0.46) * 8.4));
    const nextY = t * 255;
    const scale = nextY / Math.max(8, y);
    r *= scale;
    g *= scale;
    b *= scale;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * 1.06;
    g = gray + (g - gray) * 1.06;
    b = gray + (b - gray) * 1.06;
    if (nextY > 232) {
      const bleach = (nextY - 232) / 23;
      r += (255 - r) * bleach;
      g += (255 - g) * bleach;
      b += (255 - b) * bleach;
    }
    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }
  unsharp(data, width, height, 0.58);
}

function flattenIllumination(image: ImageData) {
  const { data, width, height } = image;
  const tw = 72;
  const th = Math.max(12, Math.round((height / Math.max(1, width)) * tw));
  const small = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / tw));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / th));
      const i = (sy * width + sx) * 4;
      small[y * tw + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  blurInPlace(small, tw, th);
  blurInPlace(small, tw, th);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = width <= 1 ? 0 : (x / (width - 1)) * (tw - 1);
      const v = height <= 1 ? 0 : (y / (height - 1)) * (th - 1);
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const x1 = Math.min(tw - 1, x0 + 1);
      const y1 = Math.min(th - 1, y0 + 1);
      const fx = u - x0;
      const fy = v - y0;
      const illum =
        small[y0 * tw + x0] * (1 - fx) * (1 - fy) +
        small[y0 * tw + x1] * fx * (1 - fy) +
        small[y1 * tw + x0] * (1 - fx) * fy +
        small[y1 * tw + x1] * fx * fy;
      const scale = 252 / Math.max(28, illum);
      const i = (y * width + x) * 4;
      data[i] = clamp(data[i] * scale, 0, 255);
      data[i + 1] = clamp(data[i + 1] * scale, 0, 255);
      data[i + 2] = clamp(data[i + 2] * scale, 0, 255);
    }
  }
}

function unsharp(data: Uint8ClampedArray, w: number, h: number, amount: number) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur =
          (copy[i + c] * 4 +
            copy[i - 4 + c] +
            copy[i + 4 + c] +
            copy[i - w * 4 + c] +
            copy[i + w * 4 + c]) /
          8;
        data[i + c] = clamp(copy[i + c] + (copy[i + c] - blur) * amount * 2, 0, 255);
      }
    }
  }
}

function outputSize(quad: Point[]) {
  const width = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  const height = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const longest = Math.max(width, height, 1);
  const scale = Math.min(MAX_OUTPUT / longest, Math.max(1, 1100 / longest));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
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

function erode(binary: Uint8Array, w: number, h: number) {
  const copy = binary.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      binary[y * w + x] =
        copy[y * w + x] &&
        copy[y * w + x - 1] &&
        copy[y * w + x + 1] &&
        copy[(y - 1) * w + x] &&
        copy[(y + 1) * w + x]
          ? 1
          : 0;
    }
  }
}

function openBinary(binary: Uint8Array, w: number, h: number) {
  erode(binary, w, h);
  dilate(binary, w, h);
}

function closeBinary(binary: Uint8Array, w: number, h: number) {
  dilate(binary, w, h);
  erode(binary, w, h);
}

function largestComponent(
  binary: Uint8Array,
  w: number,
  h: number,
  opts: { ignoreBorderHeavy: boolean },
) {
  const seen = new Uint8Array(binary.length);
  let best: { count: number; edge: Point[]; border: number } | null = null;
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
    let border = 0;
    let qi = 0;
    while (qi < qx.length) {
      const x = qx[qi];
      const y = qy[qi];
      qi += 1;
      count += 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border += 1;
      let isEdge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !binary[ny * w + nx]) {
          isEdge = true;
          continue;
        }
        const ni = ny * w + nx;
        if (!seen[ni]) {
          seen[ni] = 1;
          qx.push(nx);
          qy.push(ny);
        }
      }
      if (isEdge && edge.length < 4000) edge.push({ x, y });
    }
    if (opts.ignoreBorderHeavy && border > count * 0.45 && count > w * h * 0.5) continue;
    if (!best || count > best.count) best = { count, edge, border };
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
