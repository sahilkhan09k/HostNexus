import { redirect } from "next/navigation";

// /admin always redirects — login page decides where to go
export default function AdminRootPage() {
  redirect("/admin/login");
}
