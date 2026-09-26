"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import type { PlaceHit } from "@/lib/geo";

type Props = {
  id: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  suppressLookup?: boolean;
  onChange: (value: string) => void;
  onSelect: (place: PlaceHit) => void;
  onFocus?: () => void;
};

export default function PlaceSuggest({
  id,
  value,
  placeholder,
  required,
  suppressLookup,
  onChange,
  onSelect,
  onFocus,
}: Props) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const skip = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function placeList() {
    const el = wrapRef.current?.querySelector("input");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBox({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (suppressLookup) {
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      const clear = window.setTimeout(() => {
        setHits([]);
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(clear);
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { places?: PlaceHit[] };
        setHits(data.places ?? []);
        if ((data.places ?? []).length > 0) {
          placeList();
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch {
        setHits([]);
        setOpen(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value, suppressLookup]);

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        id={id}
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          onFocus?.();
          if (hits.length > 0) {
            placeList();
            setOpen(true);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {open && !suppressLookup && hits.length > 0 && box && typeof document !== "undefined"
        ? createPortal(
            <ul
              className="fixed z-[240] max-h-52 overflow-auto rounded-xl border border-[#d5dcf0] bg-white py-1 text-sm shadow-lg"
              style={{ left: box.left, top: box.top, width: box.width }}
            >
              {hits.map((hit) => (
                <li key={`${hit.label}-${hit.lat}-${hit.lng}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-[#eef3fb]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      skip.current = true;
                      onSelect(hit);
                      setHits([]);
                      setOpen(false);
                    }}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
