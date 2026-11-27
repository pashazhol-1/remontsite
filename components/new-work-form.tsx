"use client";

import { PhotoPicker } from "@/components/photo-picker";
import { VoiceRecorder } from "@/components/voice-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Profile, WorkCategory } from "@/types";
import { useState } from "react";

export function NewWorkForm({
  categories,
  masters,
  submitting,
  onSubmit,
}: {
  categories: WorkCategory[];
  masters: Profile[];
  submitting: boolean;
  onSubmit: (input: {
    userId?: string;
    categoryId: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    totalAmount: number | null;
    commentText: string;
    photos: File[];
    audio: Blob | null;
    audioTranscript: string | null;
  }) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const chosen = categories.find((category) => category.id === categoryId);
  const allowedMasters = masters.filter((master) => !chosen || chosen.assigneeIds.length === 0 || chosen.assigneeIds.includes(master.id));
  const [userId, setUserId] = useState(allowedMasters[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [commentText, setCommentText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!categoryId) {
      setError("Выберите вид работ");
      return;
    }
    if (masters.length > 0 && !userId) {
      setError("Выберите мастера");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("Дата окончания не может быть раньше начала");
      return;
    }
    const totalAmount = amount.trim() ? Number(amount.replace(",", ".")) : null;
    if (totalAmount !== null && Number.isNaN(totalAmount)) {
      setError("Сумма должна быть числом");
      return;
    }
    await onSubmit({
      userId: userId || undefined,
      categoryId,
      title: title.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      totalAmount,
      commentText,
      photos,
      audio,
      audioTranscript: audioTranscript.trim() || null,
    });
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет доступных видов работ. Заказчик назначает их в разделе «Виды работ».</p>;
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="work-title">Что за работа</Label>
        <Input id="work-title" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Укладка плитки в ванной" />
      </div>
      <section className="space-y-2">
        <Label>Вид работ</Label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setCategoryId(category.id);
                const nextMasters = masters.filter((master) => category.assigneeIds.length === 0 || category.assigneeIds.includes(master.id));
                setUserId(nextMasters[0]?.id ?? "");
              }}
              className={`rounded-lg border bg-white px-3 py-3 text-left text-sm ${
                category.id === categoryId ? "border-primary bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>
      {masters.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="work-master">Мастер</Label>
          <select id="work-master" className="h-9 rounded-md border bg-white px-3 text-sm" value={userId} onChange={(event) => setUserId(event.target.value)}>
            {allowedMasters.map((master) => (
              <option key={master.id} value={master.id}>{master.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="work-amount">Сумма, BYN</Label>
          <Input id="work-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="800" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="work-start">Начало</Label>
          <Input id="work-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="work-end">Окончание</Label>
          <Input id="work-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="work-comment">Комментарий</Label>
        <Textarea id="work-comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Что уже сделано или что планируется" />
      </div>
      <VoiceRecorder audio={audio} transcript={audioTranscript} onChange={(blob, transcript) => {
        setAudio(blob);
        setAudioTranscript(transcript);
      }} />
      <section className="space-y-2">
        <Label>Фотоотчёт</Label>
        <p className="text-sm text-muted-foreground">Можно добавить позже, когда работа будет готова.</p>
        <PhotoPicker files={photos} onChange={setPhotos} />
      </section>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? "Сохранение..." : "Сохранить работу"}
      </Button>
    </form>
  );
}
