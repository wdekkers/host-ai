import { handleCronSync } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleCronSync(request);
}
