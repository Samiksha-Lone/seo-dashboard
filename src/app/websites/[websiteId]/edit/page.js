import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import WebsiteForm from "@/components/management/WebsiteForm";
import ManagementError from "@/components/management/ManagementError";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditWebsitePage({ params }) {
  let website;
  let clients;
  try {
    [website, clients] = await Promise.all([
      prisma.website.findUnique({
        where: { id: params.websiteId },
        select: { id: true, name: true, url: true, clientId: true },
      }),
      prisma.client.findMany({
        orderBy: { businessName: "asc" },
        select: { id: true, businessName: true, city: true, state: true },
      }),
    ]);
  } catch (error) {
    console.error("Website edit page query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Website" /></DashboardShell>;
  }
  if (!website) notFound();

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link href={`/websites/${website.id}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← {website.name}</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Website management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Edit website</h1>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <WebsiteForm website={website} clients={clients} />
        </section>
      </div>
    </DashboardShell>
  );
}
