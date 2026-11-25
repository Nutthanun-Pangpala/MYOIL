import { checkIssueRequest } from "@/domain/bookcare-api";
import { receiveIssue } from "@/server/bookcare/receive-service";
import { driverPost } from "@/server/driver/api";

export const dynamic = "force-dynamic";

/** the driver's phone sends one slip of one route stop (same rules as API 1; the same `ref` twice = one slip) */
export async function POST(req: Request) {
  return driverPost(req, checkIssueRequest, receiveIssue);
}
