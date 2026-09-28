import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { isJpeg, isPdf, jpegToColorPdf } from "@/lib/jpeg-to-pdf";

const DIR = path.join(process.cwd(), ".data", "deliveries");

export type DeliveryFile = {
  bytes: Buffer;
  fileName: string;
  mime: string;
};

const memory = new Map<string, DeliveryFile>();

function pdfPath(courseId: string) {
  return path.join(DIR, `${courseId}.pdf`);
}

function jpgPath(courseId: string) {
  return path.join(DIR, `${courseId}.jpg`);
}

export { isJpeg };

export async function saveDeliveryPdf(courseId: string, jpegBytes: Buffer, fileName: string) {
  const pdf = jpegToColorPdf(jpegBytes);
  const stored: DeliveryFile = { bytes: pdf, fileName, mime: "application/pdf" };
  memory.set(courseId, stored);
  await mkdir(DIR, { recursive: true });
  await writeFile(pdfPath(courseId), pdf);
  await unlink(jpgPath(courseId)).catch(() => undefined);
  return stored;
}

export async function getDeliveryPdf(courseId: string): Promise<DeliveryFile | null> {
  const cached = memory.get(courseId);
  if (cached?.mime === "application/pdf") return cached;
  try {
    const bytes = await readFile(pdfPath(courseId));
    if (isPdf(bytes)) {
      const stored: DeliveryFile = {
        bytes,
        fileName: `${courseId}.pdf`,
        mime: "application/pdf",
      };
      memory.set(courseId, stored);
      return stored;
    }
  } catch {
    // Fall through to a leftover JPEG from earlier versions.
  }
  try {
    const jpeg = await readFile(jpgPath(courseId));
    if (!isJpeg(jpeg)) return null;
    return await saveDeliveryPdf(courseId, jpeg, `${courseId}.pdf`);
  } catch {
    return null;
  }
}
