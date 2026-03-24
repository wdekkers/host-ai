import { handleDetectGaps } from './handler';
export const POST = (request: Request) => handleDetectGaps(request);
