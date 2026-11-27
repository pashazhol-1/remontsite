"use client";

import { PhotoPicker } from "@/components/photo-picker";
import { VoiceRecorder } from "@/components/voice-recorder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WorkCategory } from "@/types";
import { useState } from "react";

export function NewReceiptForm({
  categories,
  submitting,
  allowSamplePhoto = false,
  onSubmit,
}: {
  categories: WorkCategory[];
  submitting: boolean;
  allowSamplePhoto?: boolean;
  onSubmit: (input: {
    categoryId: string;
    commentText: string;
    photos: File[];
    audio: Blob | null;
    audioTranscript: string | null;
  }) => Promise<void>;
}) {
  const active = categories.filter((category) => category.isActive);
  const [categoryId, setCategoryId] = useState(active[0]?.id ?? "");
  const [commentText, setCommentText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (photos.length === 0) {
      setError("Добавьте хотя бы одно фото чека");
      return;
    }
    if (!categoryId) {
      setError("Выберите вид работ");
      return;
    }
    await onSubmit({
      categoryId,
      commentText,
      photos,
      audio,
      audioTranscript: audioTranscript.trim() || null,
    });
  }

  if (active.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет доступных видов работ. Заказчик назначает их в разделе «Виды работ».</p>;
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <section className="space-y-2">
        <Label>1. Фото чека</Label>
        <PhotoPicker files={photos} onChange={setPhotos} allowSample={allowSamplePhoto} />
      </section>
      <section className="space-y-2">
        <Label>2. Вид работ</Label>
        <div className="grid grid-cols-2 gap-2">
          {active.map((category) => {
            const selected = category.id === categoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`rounded-lg border bg-white px-3 py-3 text-left text-sm ${
                  selected ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </section>
      <section className="space-y-2">
        <Label htmlFor="comment">3. Комментарий текстом</Label>
        <Textarea
          id="comment"
          placeholder="Например: материалы для штукатурки второго этажа"
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
        />
      </section>
      <section>
        <VoiceRecorder
          audio={audio}
          transcript={audioTranscript}
          onChange={(nextAudio, nextTranscript) => {
            setAudio(nextAudio);
            setAudioTranscript(nextTranscript);
          }}
        />
      </section>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={submitting}>
        {submitting ? "Отправка..." : "Отправить чек"}
      </Button>
    </form>
  );
}
