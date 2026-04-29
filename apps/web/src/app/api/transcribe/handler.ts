import { NextResponse } from 'next/server';
import { transcribeWithWhisper } from '@walt/ai';

const MAX_BYTES = 25 * 1024 * 1024;

export async function handleTranscribe(request: Request): Promise<Response> {
  const form = await request.formData();
  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio too large (max 25 MB)' }, { status: 413 });
  }
  try {
    const text = await transcribeWithWhisper(audio);
    return NextResponse.json({ transcript: text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
