import { handleGetPricingSnapshots } from './handler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleGetPricingSnapshots(request, id);
}
