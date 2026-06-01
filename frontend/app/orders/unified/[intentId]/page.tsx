import { UnifiedOrderDetailView } from "@/components/UnifiedOrderDetailView";

export default async function UnifiedOrderDetailPage({ params }: { params: Promise<{ intentId: string }> }) {
  const { intentId } = await params;
  return <UnifiedOrderDetailView intentId={intentId} />;
}
