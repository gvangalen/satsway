import { redirect } from "next/navigation";

export default async function OldGridSandboxLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pay/grid/${id}`);
}
