import { checkIssueRequest } from "@/domain/bookcare-api";
import { handlePost } from "@/server/bookcare/http";
import { receiveIssue } from "@/server/bookcare/receive-service";
import type { IssueRequest } from "@/domain/bookcare-api";
import { syncProjectsFromBookcare } from "@/server/projects/sync-from-bookcare";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** API 1 — a slip sent from the phone (contract v1). Sending it twice gives one slip. */
export async function POST(req: Request) {
  return handlePost(req, checkIssueRequest, async (v: IssueRequest) => {
    const first = await receiveIssue(v);
    if (first.ok || first.code !== "unknown_project") return first;
    // a new project may not have reached MYOIL yet: pull the list once and try again (contract, API 1)
    const synced = await syncProjectsFromBookcare({ throttle: true });
    return synced.ok ? receiveIssue(v) : first;
  });
}
