/// <reference types="vite/client" />

declare global {
  /** Web Speech API — not fully declared in all TS `lib.dom` versions */
  interface WebSpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((ev: WebSpeechRecognitionResultEvent) => void) | null;
    onerror: ((ev: WebSpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
  }

  interface WebSpeechRecognitionResultEvent {
    readonly results: SpeechRecognitionResultList;
  }

  interface WebSpeechRecognitionErrorEvent {
    readonly error: string;
  }

  type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

  interface Window {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  }
}

export {};
