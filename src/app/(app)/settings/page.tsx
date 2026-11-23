import { redirect } from "next/navigation";

export const metadata = { title: "ตั้งค่า" };

export default function Page() {
  redirect("/settings/projects");
}
