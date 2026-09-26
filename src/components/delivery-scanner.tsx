"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, ImagePlus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultQuad,
  detectDocumentQuad,
  imageDataToJpegBlob,
  imageToCanvas,
  loadImageElement,
  warpDocumentColor,
  type Point,
} from "@/lib/document-scan";

type Step = "capture" | "crop" | "preview";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
};

export default function DeliveryScanner({ open, onClose, onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndex = useRef<number | null>(null);
  const previewUrlRef = useRef("");
  const scanUrlRef = useRef("");
  const liveTimer = useRef<number | null>(null);
  const aliveRef = useRef(true);

  const [step, setStep] = useState<Step>("capture");
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [corners, setCorners] = useState<Point[]>([]);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [liveQuad, setLiveQuad] = useState<Point[] | null>(null);
  const [detected, setDetected] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveTimer.current) {
      window.clearInterval(liveTimer.current);
      liveTimer.current = null;
    }
  }, []);

  const startLiveDetect = useCallback(() => {
    if (liveTimer.current) window.clearInterval(liveTimer.current);
    const canvas = document.createElement("canvas");
    liveTimer.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const scale = 360 / Math.max(video.videoWidth, video.videoHeight);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const quad = detectDocumentQuad(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (!quad) {
        setLiveQuad(null);
        return;
      }
      const displayW = video.clientWidth || 1;
      const displayH = video.clientHeight || 1;
      const cover = Math.max(displayW / video.videoWidth, displayH / video.videoHeight);
      const dw = video.videoWidth * cover;
      const dh = video.videoHeight * cover;
      const ox = (displayW - dw) / 2;
      const oy = (displayH - dh) / 2;
      setLiveQuad(
        quad.map((p) => ({
          x: ox + (p.x / canvas.width) * video.videoWidth * cover,
          y: oy + (p.y / canvas.height) * video.videoHeight * cover,
        })),
      );
    }, 220);
  }, []);

  const startCamera = useCallback(async () => {
    stopTracks();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCamReady(true);
      setError("");
      startLiveDetect();
    } catch {
      setCamReady(false);
      setError("Caméra indisponible. Importez une photo du bon de livraison.");
    }
  }, [startLiveDetect, stopTracks]);

  useEffect(() => {
    if (!open) return;
    aliveRef.current = true;
    const boot = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      aliveRef.current = false;
      window.clearTimeout(boot);
      stopTracks();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
    };
  }, [open, startCamera, stopTracks]);

  async function processCanvas(canvas: HTMLCanvasElement, auto: boolean) {
    sourceRef.current = canvas;
    setNatural({ w: canvas.width, h: canvas.height });
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas indisponible");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = detectDocumentQuad(data);
    const quad = found ?? defaultQuad(canvas.width, canvas.height);
    setCorners(quad);
    setDetected(Boolean(found));
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }, "image/jpeg", 0.92);
    if (auto && found) {
      setBusy("Recadrage automatique du papier…");
      const scanned = warpDocumentColor(data, found);
      const jpeg = await imageDataToJpegBlob(scanned, 0.92);
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
      const url = URL.createObjectURL(jpeg);
      scanUrlRef.current = url;
      setScanUrl(url);
      setStep("preview");
      setBusy("");
      return;
    }
    setStep("crop");
    setBusy("");
    if (!found) setError("Papier non détecté. Ajustez les 4 coins, puis recadrez.");
  }

  async function ingestFile(file: File) {
    setBusy("Détection du document…");
    setError("");
    try {
      const image = await loadImageElement(file);
      const canvas = imageToCanvas(image);
      stopTracks();
      setCamReady(false);
      setLiveQuad(null);
      await processCanvas(canvas, true);
    } catch {
      setBusy("");
      setError("Impossible de lire cette image.");
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !camReady) return;
    setBusy("Scan intelligent du papier…");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopTracks();
    setCamReady(false);
    setLiveQuad(null);
    try {
      await processCanvas(canvas, true);
    } catch {
      setBusy("");
      setError("Le scan a échoué. Réessayez.");
    }
  }

  async function applyScan() {
    const canvas = sourceRef.current;
    if (!canvas || corners.length !== 4) return;
    setBusy("Recadrage couleur, comme un scan…");
    setError("");
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas indisponible");
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scanned = warpDocumentColor(data, corners);
      const blob = await imageDataToJpegBlob(scanned, 0.92);
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
      const url = URL.createObjectURL(blob);
      scanUrlRef.current = url;
      setScanUrl(url);
      setStep("preview");
      setBusy("");
    } catch {
      setBusy("");
      setError("Le recadrage a échoué. Ajustez les coins et réessayez.");
    }
  }

  function toImagePoint(event: PointerEvent<HTMLDivElement>): Point | null {
    const box = cropBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * natural.w,
      y: ((event.clientY - rect.top) / rect.height) * natural.h,
    };
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    if (step !== "crop") return;
    const p = toImagePoint(event);
    if (!p) return;
    const box = cropBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const hit = (80 / rect.width) * natural.w;
    if (event.type === "pointerdown") {
      let nearest = 0;
      let best = Infinity;
      corners.forEach((c, i) => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      if (best < hit) {
        dragIndex.current = nearest;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else if (event.type === "pointermove" && dragIndex.current != null) {
      const i = dragIndex.current;
      setCorners((prev) =>
        prev.map((c, idx) =>
          idx === i
            ? {
                x: Math.min(natural.w - 1, Math.max(0, p.x)),
                y: Math.min(natural.h - 1, Math.max(0, p.y)),
              }
            : c,
        ),
      );
    } else if (event.type === "pointerup" || event.type === "pointercancel") {
      dragIndex.current = null;
    }
  }

  async function confirm() {
    if (!scanUrl) return;
    setBusy("Pièce jointe en cours…");
    try {
      const res = await fetch(scanUrl);
      const blob = await res.blob();
      await onConfirm(blob);
    } catch {
      setBusy("");
      setError("Envoi impossible. Réessayez.");
    }
  }

  if (!open) return null;

  const handleRadius = Math.max(natural.w, natural.h) * 0.018;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0c1028] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="size-4 text-[#7dd8f7]" />
            Scan intelligent du BL
          </div>
          <p className="mt-0.5 text-[11px] text-blue-200">
            {step === "capture"
              ? liveQuad
                ? "Papier détecté — prenez la photo, le recadrage se fait tout seul."
                : "Placez le bon de livraison dans le cadre."
              : step === "crop"
                ? detected
                  ? "Vérifiez les coins détectés, puis validez."
                  : "Glissez les coins sur le papier, puis recadrez."
                : "Document recadré en couleur, comme CamScanner."}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="rounded-xl" onClick={onClose}>
          Annuler
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {step === "capture" ? (
          <div className="relative h-full bg-black">
            <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
            {liveQuad ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                <polygon
                  points={liveQuad.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(0,164,232,0.18)"
                  stroke="#00a4e8"
                  strokeWidth="4"
                />
              </svg>
            ) : (
              <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-dashed border-white/40" />
            )}
          </div>
        ) : null}

        {step === "crop" && previewUrl ? (
          <div className="flex h-full items-center justify-center bg-black p-3">
            <div
              ref={cropBoxRef}
              className="relative max-h-full max-w-full touch-none"
              onPointerDown={onPointer}
              onPointerMove={onPointer}
              onPointerUp={onPointer}
              onPointerCancel={onPointer}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Photo du BL"
                className="block max-h-[68dvh] max-w-full select-none"
                draggable={false}
              />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${natural.w} ${natural.h}`}
                preserveAspectRatio="none"
              >
                <polygon
                  points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
                  fill="rgba(0,164,232,0.18)"
                  stroke="#00a4e8"
                  strokeWidth={Math.max(4, natural.w * 0.004)}
                />
                {corners.map((c, i) => (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={handleRadius}
                    fill="#2b308f"
                    stroke="#ffffff"
                    strokeWidth={Math.max(3, natural.w * 0.003)}
                  />
                ))}
              </svg>
            </div>
          </div>
        ) : null}

        {step === "preview" && scanUrl ? (
          <div className="flex h-full items-center justify-center bg-[#151a45] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scanUrl} alt="Scan couleur du BL" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          </div>
        ) : null}

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium">
            {busy}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {error ? <p className="text-center text-xs text-red-300">{error}</p> : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void ingestFile(file);
          }}
        />
        {step === "capture" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-12 rounded-xl"
              onClick={() => {
                if (!camReady) {
                  void startCamera();
                  return;
                }
                void captureFrame();
              }}
              disabled={Boolean(busy)}
            >
              <Camera />
              {camReady ? "Scanner le papier" : "Ouvrir la caméra"}
            </Button>
            <Button variant="secondary" className="h-12 rounded-xl" onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              Importer
            </Button>
          </div>
        ) : null}
        {step === "crop" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-12 rounded-xl"
              onClick={() => {
                setStep("capture");
                setError("");
                void startCamera();
              }}
            >
              Reprendre
            </Button>
            <Button className="h-12 rounded-xl" onClick={() => void applyScan()} disabled={Boolean(busy)}>
              Recadrer le papier
            </Button>
          </div>
        ) : null}
        {step === "preview" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-12 rounded-xl" onClick={() => setStep("crop")}>
              Ajuster
            </Button>
            <Button className="h-12 rounded-xl" onClick={() => void confirm()} disabled={Boolean(busy)}>
              Joindre et terminer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

