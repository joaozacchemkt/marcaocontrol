import { useCallback, useEffect, useRef, useState } from "react";

/** Tipos mínimos da Web Speech API (não vêm no lib.dom do TS). */
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Ditado por voz (pt-BR) com a API do próprio navegador — sem custo e sem
 * mandar áudio pra servidor nosso. `onText` recebe o texto acumulado.
 * Onde o navegador não suporta, `supported` é false e o botão some.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(getCtor() !== null), []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(
    (currentText: string) => {
      const Ctor = getCtor();
      if (!Ctor || recRef.current) return;
      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      baseRef.current = currentText ? `${currentText.trim()} ` : "";
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        onTextRef.current((baseRef.current + finalText + interim).replace(/\s+/g, " ").trimStart());
      };
      rec.onerror = () => undefined; // "no-speech"/"aborted" etc.: só encerra
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
      };
      recRef.current = rec;
      setListening(true);
      try {
        rec.start();
      } catch {
        recRef.current = null;
        setListening(false);
      }
    },
    [],
  );

  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, start, stop };
}
