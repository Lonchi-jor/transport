import { NextResponse } from "next/server";
import { attachDeliveryScan, getCourse, updateCourse } from "@/lib/course-store";
import { getDeliveryPdf, isJpeg, saveDeliveryPdf } from "@/lib/delivery-store";
import { JpegError } from "@/lib/jpeg-to-pdf";
import { snapshotFromRequest } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function pdfName(reference: string, storedName?: string | null) {
  const base = (storedName || `${reference}-bon-livraison`).replace(/\.(jpe?g|png|pdf)$/i, "");
  return `${base}.pdf`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const course = getCourse(id);
  if (!course?.hasDeliveryScan) {
    return NextResponse.json({ error: "Aucun bon de livraison joint." }, { status: 404 });
  }
  let file;
  try {
    file = await getDeliveryPdf(id);
  } catch {
    file = null;
  }
  if (!file) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  const downloadName = pdfName(course.reference, course.deliveryFileName);
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
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
    return NextResponse.json({ error: "Envoyez une photo JPEG." }, { status: 400 });
  }
  const fileName = `${course.reference}-bon-livraison.pdf`;
  try {
    await saveDeliveryPdf(id, bytes, fileName);
  } catch (error) {
    const message = error instanceof JpegError ? error.message : "Impossible de créer le PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
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
  return NextResponse.json({ ok: true, ...snapshotFromRequest(request) });
}
