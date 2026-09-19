import AdminDashboard from "@/components/admin-dashboard";

export default function AdminPage() {
  return (
    <AdminDashboard
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
    />
  );
}
