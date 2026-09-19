"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { PlaceHit } from "@/lib/geo";

type Props = {
  id: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
  onSelect: (place: PlaceHit) => void;
};

export default function PlaceSuggest({
  id,
  value,
  placeholder,
  required,
  onChange,
  onSelect,
}: Props) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      const clear = window.setTimeout(() => setHits([]), 0);
      return () => window.clearTimeout(clear);
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { places?: PlaceHit[] };
        setHits(data.places ?? []);
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-[#d5dcf0] bg-white py-1 text-sm shadow-lg">
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
        </ul>
      ) : null}
    </div>
  );
}
