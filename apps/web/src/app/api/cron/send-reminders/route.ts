import { handleSendReminders } from './handler';
export const POST = (request: Request) => handleSendReminders(request);
