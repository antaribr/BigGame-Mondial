import { isAdmin } from "./actions";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();
  return admin ? <AdminDashboard /> : <AdminLogin />;
}
