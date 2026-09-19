import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DIR = path.join(process.cwd(), ".data", "deliveries");

export type DeliveryFile = {
  bytes: Buffer;
  fileName: string;
  mime: string;
};

const memory = new Map<string, DeliveryFile>();

function filePath(courseId: string) {
  return path.join(DIR, `${courseId}.jpg`);
}

export async function saveDeliveryScan(courseId: string, bytes: Buffer, fileName: string) {
  const stored: DeliveryFile = { bytes, fileName, mime: "image/jpeg" };
  memory.set(courseId, stored);
  await mkdir(DIR, { recursive: true });
  await writeFile(filePath(courseId), bytes);
  return stored;
}

export async function getDeliveryScan(courseId: string): Promise<DeliveryFile | null> {
  const cached = memory.get(courseId);
  if (cached) return cached;
  try {
    const bytes = await readFile(filePath(courseId));
    const stored: DeliveryFile = {
      bytes,
      fileName: `${courseId}.jpg`,
      mime: "image/jpeg",
    };
    memory.set(courseId, stored);
    return stored;
  } catch {
    return null;
  }
}

export function isJpeg(bytes: Buffer) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
