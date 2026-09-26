"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, LayoutDashboard, Truck } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  active: "dispatch" | "courses" | "chauffeurs";
  online: boolean;
  extra?: ReactNode;
};

export default function AdminChrome({ active, online, extra }: Props) {
  return (
    <header className="border-b border-[#d5dcf0] bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-12 w-auto max-w-[180px] object-contain" />
          <Link
            href="/admin"
            aria-current={active === "dispatch" ? "page" : undefined}
            className={cn(
              "hidden cursor-pointer rounded-xl border px-3 py-2 text-left transition sm:block",
              active === "dispatch"
                ? "border-[#00a4e8]/50 bg-[#e7f6fd] shadow-sm"
                : "border-[#d5dcf0] hover:border-[#00a4e8] hover:bg-[#f4f7fc]",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2b308f]">
              <LayoutDashboard className="size-4 text-[#00a4e8]" />
              Tableau de bord dispatch
            </div>
            <div className="pl-6 text-xs text-[#5b6294]">Courses, carte et attribution</div>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className={cn(
              buttonVariants({ variant: active === "dispatch" ? "default" : "secondary", size: "default" }),
              "rounded-xl sm:hidden",
            )}
          >
            <LayoutDashboard className="size-4" />
            Tableau de bord
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef3fb] px-3 py-1 text-xs font-medium">
            <span className={`size-2 rounded-full ${online ? "bg-[#00a4e8]" : "bg-red-500"}`} />
            {online ? "Radio live" : "Hors ligne"}
          </span>
          <Link
            href="/admin/courses"
            className={cn(
              buttonVariants({ variant: active === "courses" ? "default" : "secondary", size: "default" }),
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
