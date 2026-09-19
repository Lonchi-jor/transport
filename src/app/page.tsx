import FleetApp from "@/components/fleet-app";

export default function Home() {
  return (
    <FleetApp
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
    />
  );
}
