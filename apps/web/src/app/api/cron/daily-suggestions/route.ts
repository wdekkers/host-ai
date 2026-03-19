import { handleDailySuggestions } from './handler';
export const POST = (request: Request) => handleDailySuggestions(request);
