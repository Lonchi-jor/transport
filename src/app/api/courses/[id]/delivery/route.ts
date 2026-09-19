import { NextResponse } from "next/server";
import { attachDeliveryScan, getCourse, updateCourse } from "@/lib/course-store";
import { getDeliveryScan, isJpeg, saveDeliveryScan } from "@/lib/delivery-store";
import { radioSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const course = getCourse(id);
  if (!course?.hasDeliveryScan) {
    return NextResponse.json({ error: "Aucun bon de livraison scanné." }, { status: 404 });
  }
  const file = await getDeliveryScan(id);
  if (!file) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  const downloadName = file.fileName || `${course.reference}-bon-livraison.jpg`;
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const course = getCourse(id);
  if (!course) {
    return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Joignez la photo du bon de livraison." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image trop lourde (8 Mo max)." }, { status: 400 });
  }
  if (!isJpeg(bytes)) {
    return NextResponse.json({ error: "Le scan doit être une image JPEG." }, { status: 400 });
  }
  const fileName = `${course.reference}-bon-livraison.jpg`;
  await saveDeliveryScan(id, bytes, fileName);
  attachDeliveryScan(id, fileName);
  const complete = String(form.get("complete") ?? "") === "true";
  if (complete) {
    const updated = updateCourse(id, { status: "done" });
    if (!updated) {
      return NextResponse.json(
        { error: "Le bon de livraison est obligatoire pour terminer." },
        { status: 400 },
      );
    }
  }
  return NextResponse.json({ ok: true, ...radioSnapshot() });
}
