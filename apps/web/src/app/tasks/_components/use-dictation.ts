'use client';

import { useCallback, useRef, useState } from 'react';

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    | ((e: {
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export type DictationState = {
  transcript: string;
  setTranscript(value: string): void;
  isRecording: boolean;
  start(): Promise<void>;
  stop(): void;
  error: string | null;
  needsWhisperFallback: boolean;
};

export function useDictation(): DictationState {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsWhisperFallback, setNeedsWhisperFallback] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const stop = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(async (): Promise<void> => {
    setError(null);

    const RecognitionCtor: SpeechRecognitionCtor | undefined =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;

    if (!RecognitionCtor) {
      setNeedsWhisperFallback(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const form = new FormData();
          form.append('audio', new File([blob], 'recording.webm', { type: blob.type }));
          try {
            const res = await fetch('/api/transcribe', { method: 'POST', body: form });
            if (!res.ok) throw new Error(`Transcribe failed (${res.status})`);
            const data = (await res.json()) as { transcript: string };
            setTranscript((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
          } catch (err) {
            setError((err as Error).message);
          }
          recorderRef.current = null;
          setIsRecording(false);
        };
        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording');
        setIsRecording(false);
      }
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (e) => {
        let finalPart = '';
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          if (result !== undefined && result.isFinal) {
            finalPart += result[0].transcript;
          }
        }
        if (finalPart) {
          setTranscript((prev) => (prev ? `${prev} ${finalPart}` : finalPart));
        }
      };

      recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow mic access and try again.');
        } else {
          setError(`Speech recognition error: ${e.error}`);
        }
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  return {
    transcript,
    setTranscript,
    isRecording,
    start,
    stop,
    error,
    needsWhisperFallback,
  };
}
