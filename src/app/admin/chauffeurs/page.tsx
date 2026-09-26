import { Suspense } from "react";
import ChauffeursDashboard from "@/components/chauffeurs-dashboard";

export default function ChauffeursPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-[#5b6294]">
          Chargement des chauffeurs…
        </div>
      }
    >
      <ChauffeursDashboard />
    </Suspense>
  );
}
