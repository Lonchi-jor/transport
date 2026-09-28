"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "capture" | "preview";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
};

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage JPEG impossible"))),
      "image/jpeg",
      quality,
    );
  });
}

function fitCanvas(sourceW: number, sourceH: number, maxSide = 2400) {
  const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH, 1));
  return {
    width: Math.max(1, Math.round(sourceW * scale)),
    height: Math.max(1, Math.round(sourceH * scale)),
  };
}

export default function DeliveryPhoto({ open, onClose, onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoUrlRef = useRef("");
  const photoBlobRef = useRef<Blob | null>(null);
  const aliveRef = useRef(true);

  const [step, setStep] = useState<Step>("capture");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [camReady, setCamReady] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearPhoto = useCallback(() => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = "";
    photoBlobRef.current = null;
    setPhotoUrl("");
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
      await waitForPaint();
      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCamReady(true);
      setError("");
    } catch {
      setCamReady(false);
      setError("Caméra indisponible. Importez une photo du bon de livraison.");
    }
  }, [stopTracks]);

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
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    };
  }, [open, startCamera, stopTracks]);

  function showPhoto(blob: Blob) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(blob);
    photoUrlRef.current = url;
    photoBlobRef.current = blob;
    setPhotoUrl(url);
    setStep("preview");
    setBusy("");
  }

  async function ingestFile(file: File) {
    setBusy("Lecture de la photo…");
    setError("");
    try {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("illisible"));
        image.src = url;
      });
      URL.revokeObjectURL(url);
      const size = fitCanvas(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible");
      ctx.drawImage(image, 0, 0, size.width, size.height);
      stopTracks();
      setCamReady(false);
      showPhoto(await canvasToJpeg(canvas));
    } catch {
      setBusy("");
      setError("Impossible de lire cette image.");
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !camReady) return;
    const sourceW = video.videoWidth || 1280;
    const sourceH = video.videoHeight || 720;
    const size = fitCanvas(sourceW, sourceH);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, size.width, size.height);
    stopTracks();
    setCamReady(false);
    setError("");
    try {
      showPhoto(await canvasToJpeg(canvas));
    } catch {
      setError("La photo a échoué. Réessayez.");
    }
  }

  async function confirm() {
    const blob = photoBlobRef.current;
    if (!blob) return;
    setBusy("Envoi de la photo…");
    setError("");
    try {
      await onConfirm(blob);
    } catch {
      setBusy("");
      setError("Envoi impossible. Réessayez.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0c1028] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="size-4 text-[#7dd8f7]" />
            Photo du BL
          </div>
          <p className="mt-0.5 text-[11px] text-blue-200">
            {step === "capture"
              ? "Cadrez le bon de livraison, puis prenez la photo."
              : "Vérifiez la photo, puis envoyez. Elle sera enregistrée en PDF couleur."}
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
            <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-dashed border-white/40" />
          </div>
        ) : null}

        {step === "preview" && photoUrl ? (
          <div className="flex h-full items-center justify-center bg-black p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Photo du BL" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        ) : null}

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium">{busy}</div>
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
              {camReady ? "Prendre la photo" : "Ouvrir la caméra"}
            </Button>
            <Button variant="secondary" className="h-12 rounded-xl" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              Importer
            </Button>
          </div>
        ) : null}
        {step === "preview" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-12 rounded-xl"
              onClick={() => {
                clearPhoto();
                setStep("capture");
                setError("");
                void startCamera();
              }}
            >
              Reprendre
            </Button>
            <Button className="h-12 rounded-xl" onClick={() => void confirm()} disabled={Boolean(busy)}>
              Envoyer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
