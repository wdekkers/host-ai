import { handleAdminSync } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleAdminSync(request);
}
