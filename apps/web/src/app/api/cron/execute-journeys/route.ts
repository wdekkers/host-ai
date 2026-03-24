import { handleExecuteJourneys } from './handler';
export const POST = (request: Request) => handleExecuteJourneys(request);
