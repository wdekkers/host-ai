import { handleGetMappings, handleSaveMappings } from './handler';

export async function GET(request: Request): Promise<Response> {
  return handleGetMappings(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleSaveMappings(request);
}
