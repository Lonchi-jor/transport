"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, Truck } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  active: "dispatch" | "chauffeurs";
  online: boolean;
  title: string;
  subtitle: string;
  extra?: ReactNode;
};

export default function AdminChrome({ active, online, title, subtitle, extra }: Props) {
  return (
    <header className="border-b border-[#d5dcf0] bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <BrandLogo className="h-12 w-auto max-w-[200px] object-contain" />
          <div className="hidden border-l border-[#d5dcf0] pl-4 sm:block">
            <div className="text-sm font-semibold text-[#2b308f]">{title}</div>
            <div className="text-xs text-[#5b6294]">{subtitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3fb] px-3 py-1 text-xs font-medium">
            <span className={`size-2 rounded-full ${online ? "bg-[#00a4e8]" : "bg-red-500"}`} />
            {online ? "Radio live" : "Hors ligne"}
          </span>
          <Link
            href="/admin"
            className={cn(
              buttonVariants({ variant: active === "dispatch" ? "default" : "secondary", size: "default" }),
              "rounded-xl",
            )}
          >
            <ClipboardList className="size-4" />
            Courses
          </Link>
          <Link
            href="/admin/chauffeurs"
            className={cn(
              buttonVariants({ variant: active === "chauffeurs" ? "default" : "secondary", size: "default" }),
              "rounded-xl",
            )}
          >
            <Truck className="size-4" />
            Chauffeurs
          </Link>
          {extra}
          <Link href="/" className="px-1 text-xs text-[#00a4e8] underline-offset-2 hover:underline">
            App téléphone
          </Link>
        </div>
      </div>
    </header>
  );
}
