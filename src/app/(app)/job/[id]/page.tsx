import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/server/auth/session";
import { forWorkspace } from "@/server/db/scope";
import { loadJobState } from "@/server/pipeline/job-state";
import { JobView } from "./_components/job-view";
import { requestLocale } from "@/server/step-text";
import { storeTargets } from "@/server/stores/targets";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("job"))("title") };
}

/**
 * S5 Processing. The first render comes straight from saved state, so a refresh shows
 * finished steps at once; the client runner then continues from the first unfinished one.
 */
export default async function JobPage({ params }: PageProps<"/job/[id]">) {
  const viewer = await requireWorkspace();
  const { id } = await params;
  const [state, job, targets] = await Promise.all([
    loadJobState(viewer.workspace, id, await requestLocale()),
    forWorkspace(viewer.workspace.id).getJob(id),
    storeTargets(viewer.workspace),
  ]);
  if (!state || !job) notFound();
  return <JobView initial={state} archived={!!job.archived_at} hasStore={targets.length > 0} />;
}
