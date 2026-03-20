import { handleIftttPoolTemp } from './handler';

export async function POST(request: Request) {
  return handleIftttPoolTemp(request);
}
