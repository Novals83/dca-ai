import { Workspace } from "@/components/workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const params = await searchParams;
  return <Workspace initialConnect={params.connect !== undefined} />;
}
