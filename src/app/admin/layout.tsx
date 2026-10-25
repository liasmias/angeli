import { adminSeiteSichern } from "@/lib/admin-guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await adminSeiteSichern();

  return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</div>;
}
