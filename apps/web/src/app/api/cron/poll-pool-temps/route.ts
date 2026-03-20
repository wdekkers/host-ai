import { handlePollPoolTemps } from './handler';
export const POST = (request: Request) => handlePollPoolTemps(request);
