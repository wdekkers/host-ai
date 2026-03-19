import { handleScanMessages } from './handler';
export const POST = (request: Request) => handleScanMessages(request);
