import { requireDriver } from "@/lib/session";

/** every /driver page is the fuel-truck driver's (phone + PIN login); office people never land here */
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  await requireDriver();
  return children;
}
