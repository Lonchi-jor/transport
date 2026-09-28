/** Embed a JPEG as a color PDF page. The JPEG bytes are kept (DCTDecode), so RGB color is unchanged. */

export class JpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JpegError";
  }
}

type JpegInfo = {
  width: number;
  height: number;
  components: number;
};

export function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isPdf(bytes: Buffer) {
  return bytes.length > 4 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

export function jpegToColorPdf(jpeg: Buffer): Buffer {
  if (!isJpeg(jpeg)) {
    throw new JpegError("Le fichier n’est pas une image JPEG.");
  }
  const { width, height, components } = readJpegInfo(jpeg);
  const colorSpace = components === 1 ? "/DeviceGray" : components === 4 ? "/DeviceCMYK" : "/DeviceRGB";

  const a4w = 595.28;
  const a4h = 841.89;
  const margin = 28;
  const portrait = height >= width;
  const pageW = portrait ? a4w : a4h;
  const pageH = portrait ? a4h : a4w;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / width, maxH / height);
  const drawW = width * scale;
  const drawH = height * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const content = `q\n${fmt(drawW)} 0 0 ${fmt(drawH)} ${fmt(x)} ${fmt(y)} cm\n/Im0 Do\nQ\n`;
  const contentBuf = Buffer.from(content, "ascii");

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "ascii"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(pageW)} ${fmt(pageH)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
      "ascii",
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        "ascii",
      ),
      jpeg,
      Buffer.from("\nendstream", "ascii"),
    ]),
    Buffer.concat([
      Buffer.from(`<< /Length ${contentBuf.length} >>\nstream\n`, "ascii"),
      contentBuf,
      Buffer.from("endstream", "ascii"),
    ]),
  ];

  return assemblePdf(objects);
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function assemblePdf(objects: Buffer[]) {
  const header = Buffer.from("%PDF-1.4\n%\x80\x80\x80\x80\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets = [0];
  let pos = header.length;
  objects.forEach((body, index) => {
    offsets.push(pos);
    const obj = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "ascii"),
      body,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    chunks.push(obj);
    pos += obj.length;
  });
  const xrefStart = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"), Buffer.from(trailer, "ascii"));
  return Buffer.concat(chunks);
}

function readJpegInfo(bytes: Buffer): JpegInfo {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) break;
    const length = bytes.readUInt16BE(i + 2);
    if (length < 2) break;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      const height = bytes.readUInt16BE(i + 5);
      const width = bytes.readUInt16BE(i + 7);
      const components = bytes[i + 9];
      if (!width || !height || !components) {
        throw new JpegError("JPEG incomplet.");
      }
      return { width, height, components };
    }
    i += 2 + length;
  }
  throw new JpegError("Impossible de lire l’image JPEG.");
}
