"use client";

import { Button } from "@/components/ui/button";
import { pickRecorderMimeType } from "@/lib/files";
import { Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognition() {
  const browser = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

export function VoiceRecorder({
  audio,
  transcript,
  onChange,
}: {
  audio: Blob | null;
  transcript: string;
  onChange: (audio: Blob | null, transcript: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [liveText, setLiveText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const speechRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef("");

  useEffect(() => {
    if (!audio) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audio);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      transcriptRef.current = "";
      setLiveText("");
      const Speech = speechRecognition();
      if (Speech) {
        const recognition = new Speech();
        recognition.lang = "ru-RU";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let text = "";
          for (let index = 0; index < event.results.length; index += 1) {
            text += event.results[index][0]?.transcript ?? "";
          }
          transcriptRef.current = text.trim();
          setLiveText(transcriptRef.current);
        };
        recognition.onerror = () => {
          setError("Речь не распознана. Запись сохранится, текст можно дописать вручную.");
        };
        speechRef.current = recognition;
        try {
          recognition.start();
        } catch {
          setError("Не удалось включить распознавание речи. Запись всё равно сохранится.");
        }
      } else {
        setError("Этот браузер не переводит голос в текст. Запись всё равно сохранится. Удобнее Chrome.");
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        speechRef.current?.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onChange(blob, transcriptRef.current);
        setRecording(false);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Не удалось включить микрофон. Разрешите доступ в браузере.");
    }
  }

  function stop() {
    mediaRef.current?.stop();
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Голосовой комментарий</div>
          <div className="text-xs text-muted-foreground">Необязательно. Речь сохранится и как запись, и как текст.</div>
        </div>
        {recording ? (
          <Button type="button" variant="destructive" onClick={stop}>
            <Square />
            Стоп
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => void start()}>
            <Mic />
            Записать
          </Button>
        )}
      </div>
      {recording ? <p className="text-sm text-red-600">Идёт запись... {liveText}</p> : null}
      {previewUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <audio controls src={previewUrl} className="w-full" />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null, "")} aria-label="Удалить запись">
              <Trash2 />
            </Button>
          </div>
          <p className="text-sm">{transcript || "Текст речи пока пустой."}</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
