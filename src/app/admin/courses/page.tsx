import { Suspense } from "react";
import CoursesBoard from "@/components/courses-board";

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-[#5b6294]">
          Chargement des courses…
        </div>
      }
    >
      <CoursesBoard />
    </Suspense>
  );
}
