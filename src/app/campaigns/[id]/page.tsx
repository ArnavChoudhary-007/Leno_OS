export default async function CampaignPage({
  params,
}: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  // TODO: render campaign status, drafts, and the human approval flow.
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">Campaign {id}</h1>
      <p className="mt-2 text-muted-foreground">Coming soon.</p>
    </main>
  );
}
