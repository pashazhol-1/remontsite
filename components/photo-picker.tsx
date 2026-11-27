"use client";

import { Button } from "@/components/ui/button";
import { createSampleReceiptFile } from "@/lib/demo/sample-photo";
import { Camera, ImagePlus, X } from "lucide-react";
import { useRef } from "react";

export function PhotoPicker({
  files,
  onChange,
  allowSample = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  allowSample?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    onChange([...files, ...Array.from(list)]);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, current) => current !== index));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera />
          Сделать фото
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus />
          Из галереи
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {allowSample ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          onClick={() => onChange([...files, createSampleReceiptFile()])}
        >
          Подставить пример фото
        </Button>
      ) : null}
      {files.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white"
                aria-label="Удалить фото"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Можно прикрепить несколько фотографий одного чека.
        </p>
      )}
    </div>
  );
}
