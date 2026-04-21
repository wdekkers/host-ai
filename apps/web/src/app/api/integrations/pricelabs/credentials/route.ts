import { handleSaveCredentials, handleDeleteCredentials } from './handler';

export async function POST(request: Request): Promise<Response> {
  return handleSaveCredentials(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleDeleteCredentials(request);
}
