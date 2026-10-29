import { redirect } from "next/navigation";

// Partner totals now live on the Analytics page.
export default function PartnersPage() {
  redirect("/analytics");
}
