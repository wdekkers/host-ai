export async function POST() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'content-type': 'text/xml' } },
  );
}
