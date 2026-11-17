function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: Blob) {
  if (typeof createImageBitmap !== "function") return readAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return readAsDataUrl(file);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.75);
  });
  if (!blob) return readAsDataUrl(file);
  return readAsDataUrl(blob);
}

export async function fileToDataUrl(file: Blob) {
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    try {
      return await compressImage(file);
    } catch {
      return readAsDataUrl(file);
    }
  }
  return readAsDataUrl(file);
}

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
