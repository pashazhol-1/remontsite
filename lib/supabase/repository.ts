import { statusAfterRecognition } from "@/lib/ai/assess";
import { recognizeReceiptPhotos } from "@/lib/ai/client";
import { DEFAULT_CURRENCY, loginFromEmail, toAuthEmail } from "@/lib/config";
import type { AppRepository } from "@/lib/data/repository";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile, Receipt, ReceiptImage, ReceiptItem, UserRole, WorkCategory } from "@/types";
import type { User } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type ReceiptRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  store_name: string | null;
  receipt_date: string | null;
  receipt_number: string | null;
  total_amount: number | string | null;
  currency: string | null;
  status: Receipt["status"];
  comment_text: string | null;
  audio_url: string | null;
  audio_transcription: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { name: string } | { name: string }[] | null;
  work_categories?: { name: string } | { name: string }[] | null;
  receipt_images?: { id: string; storage_path: string }[];
  receipt_items?: {
    id: string;
    name: string;
    quantity: number | string;
    unit_price: number | string;
    total_price: number | string;
  }[];
  ai_processing?: {
    provider: string | null;
    model: string | null;
    processing_status: string;
    confidence: number | string | null;
    error_message: string | null;
    created_at: string;
  }[];
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    login: loginFromEmail(row.email),
    role: row.role,
    createdAt: row.created_at,
  };
}

function nestedName(value: { name: string } | { name: string }[] | null | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? (value[0]?.name ?? "") : value.name;
}

async function signedUrl(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  bucket: string,
  path: string | null,
) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
  if (error) return null;
  return data.signedUrl;
}

async function mapReceipt(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  row: ReceiptRow,
): Promise<Receipt> {
  const images: ReceiptImage[] = await Promise.all(
    (row.receipt_images ?? []).map(async (image) => ({
      id: image.id,
      path: image.storage_path,
      url: (await signedUrl(client, "receipt-photos", image.storage_path)) ?? "",
    })),
  );
  const ai = [...(row.ai_processing ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const items: ReceiptItem[] = (row.receipt_items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    totalPrice: Number(item.total_price),
  }));
  return {
    id: row.id,
    userId: row.user_id,
    userName: nestedName(row.profiles) || "Строитель",
    categoryId: row.category_id ?? "",
    categoryName: nestedName(row.work_categories) || "Без категории",
    storeName: row.store_name,
    receiptDate: row.receipt_date,
    receiptNumber: row.receipt_number,
    totalAmount: row.total_amount === null ? null : Number(row.total_amount),
    currency: row.currency ?? DEFAULT_CURRENCY,
    status: row.status,
    commentText: row.comment_text,
    audioUrl: await signedUrl(client, "receipt-audio", row.audio_url),
    audioTranscription: row.audio_transcription,
    recognition: ai
      ? {
          provider: ai.provider ?? "",
          model: ai.model ?? "",
          confidence: ai.confidence == null ? null : Number(ai.confidence),
          needsReview: ai.processing_status !== "ok",
          reviewReason: ai.error_message,
        }
      : null,
    images: images.filter((image) => image.url),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const receiptSelect = `
  *,
  profiles ( name ),
  work_categories ( name ),
  receipt_images ( id, storage_path ),
  receipt_items ( id, name, quantity, unit_price, total_price ),
  ai_processing ( provider, model, processing_status, confidence, error_message, created_at )
`;

export function createSupabaseRepository(): AppRepository {
  const client = createSupabaseBrowserClient();

  async function loadProfile(user: User | null) {
    if (!user) return null;
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapProfile(data as ProfileRow);
  }

  return {
    async getSession() {
      const { data } = await client.auth.getUser();
      return loadProfile(data.user);
    },
    async signIn(login, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: toAuthEmail(login),
        password,
      });
      if (error) throw new Error("Неверный логин или пароль");
      const profile = await loadProfile(data.user);
      if (!profile) throw new Error("Профиль не найден. Проверьте, что SQL из supabase/schema.sql выполнен.");
      return profile;
    },
    async signUp(name, login, password) {
      const email = toAuthEmail(login);
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { name, login: login.trim().toLowerCase() },
        },
      });
      if (error) throw new Error(error.message);
      const profile = await loadProfile(data.user);
      if (!profile) {
        throw new Error(
          "Аккаунт создан, но профиль ещё не появился. Если в Supabase включено подтверждение email — отключите его для теста или подтвердите письмо.",
        );
      }
      return profile;
    },
    async signInWithGoogle() {
      const origin = window.location.origin;
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await client.auth.signOut();
    },
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        void loadProfile(session?.user ?? null).then(callback);
      });
      return () => data.subscription.unsubscribe();
    },
    async listUsers() {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ProfileRow[]).map(mapProfile);
    },
    async listCategories() {
      const { data, error } = await client
        .from("work_categories")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as CategoryRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    },
    async createCategory(input) {
      const { data, error } = await client
        .from("work_categories")
        .insert({
          name: input.name.trim(),
          description: input.description.trim(),
          is_active: input.isActive,
        })
        .select("*")
        .single();
      if (error) throw error;
      const row = data as CategoryRow;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        isActive: row.is_active,
        createdAt: row.created_at,
      };
    },
    async updateCategory(id, input) {
      const { data, error } = await client
        .from("work_categories")
        .update({
          name: input.name.trim(),
          description: input.description.trim(),
          is_active: input.isActive,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const row = data as CategoryRow;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        isActive: row.is_active,
        createdAt: row.created_at,
      };
    },
    async deleteCategory(id) {
      const { error } = await client.from("work_categories").delete().eq("id", id);
      if (error) {
        throw new Error("Нельзя удалить вид работ, к которому уже привязаны чеки. Можно его отключить.");
      }
    },
    async listReceipts(scope) {
      let query = client.from("receipts").select(receiptSelect).order("created_at", { ascending: false });
      if (scope === "mine") {
        const session = await this.getSession();
        if (!session) return [];
        query = query.eq("user_id", session.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return Promise.all((data as ReceiptRow[]).map((row) => mapReceipt(client, row)));
    },
    async getReceipt(id) {
      const { data, error } = await client
        .from("receipts")
        .select(receiptSelect)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapReceipt(client, data as ReceiptRow);
    },
    async createReceipt(input) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      let recognition = null;
      try {
        recognition = await recognizeReceiptPhotos(input.photos);
      } catch {
        recognition = null;
      }
      const { data: receipt, error } = await client
        .from("receipts")
        .insert({
          user_id: session.id,
          category_id: input.categoryId,
          comment_text: input.commentText.trim() || null,
          audio_transcription: input.audioTranscript?.trim() || null,
          store_name: recognition?.storeName ?? null,
          receipt_date: recognition?.receiptDate ?? null,
          receipt_number: recognition?.receiptNumber ?? null,
          total_amount: recognition?.totalAmount ?? null,
          currency: recognition?.currency ?? DEFAULT_CURRENCY,
          status: recognition
            ? statusAfterRecognition("pending_review", recognition.needsReview)
            : "pending_review",
        })
        .select("id")
        .single();
      if (error || !receipt) throw error ?? new Error("Не удалось сохранить чек");

      const uploads = input.photos.map(async (file, index) => {
        const path = `${session.id}/${receipt.id}/${index}-${file.name}`;
        const { error: uploadError } = await client.storage
          .from("receipt-photos")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await client.from("receipt_images").insert({
          receipt_id: receipt.id,
          storage_path: path,
          sort_order: index,
        });
        if (rowError) throw rowError;
      });
      await Promise.all(uploads);

      if (recognition) {
        if (recognition.items.length > 0) {
          const { error: itemsError } = await client.from("receipt_items").insert(
            recognition.items.map((item) => ({
              receipt_id: receipt.id,
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price: item.totalPrice,
            })),
          );
          if (itemsError) throw itemsError;
        }
        const { error: aiError } = await client.from("ai_processing").insert({
          receipt_id: receipt.id,
          provider: recognition.provider,
          model: recognition.model,
          processing_status: recognition.needsReview ? "needs_review" : "ok",
          confidence: recognition.confidence,
          error_message: recognition.reviewReason,
        });
        if (aiError) throw aiError;
      }

      if (input.audio) {
        const audioPath = `${session.id}/${receipt.id}/comment.webm`;
        const { error: audioError } = await client.storage
          .from("receipt-audio")
          .upload(audioPath, input.audio, { upsert: false, contentType: input.audio.type || "audio/webm" });
        if (audioError) throw audioError;
        await client.from("receipts").update({ audio_url: audioPath }).eq("id", receipt.id);
      }

      const created = await this.getReceipt(receipt.id);
      if (!created) throw new Error("Чек сохранён, но не удалось его прочитать");
      return created;
    },
    async updateReceipt(id, patch) {
      const session = await this.getSession();
      const current = patch.status ? await this.getReceipt(id) : null;
      const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("categoryId" in patch) changes.category_id = patch.categoryId;
      if ("storeName" in patch) changes.store_name = patch.storeName;
      if ("receiptDate" in patch) changes.receipt_date = patch.receiptDate;
      if ("receiptNumber" in patch) changes.receipt_number = patch.receiptNumber;
      if ("totalAmount" in patch) changes.total_amount = patch.totalAmount;
      if ("currency" in patch) changes.currency = patch.currency;
      if ("commentText" in patch) changes.comment_text = patch.commentText;
      if ("audioTranscription" in patch) changes.audio_transcription = patch.audioTranscription;
      if ("status" in patch) changes.status = patch.status;
      const { error } = await client.from("receipts").update(changes).eq("id", id);
      if (error) throw error;
      if (current && patch.status && current.status !== patch.status && session) {
        const { error: historyError } = await client.from("payment_history").insert({
          receipt_id: id,
          user_id: session.id,
          previous_status: current.status,
          new_status: patch.status,
        });
        if (historyError) throw historyError;
      }
      if (patch.items) {
        const { error: deleteError } = await client.from("receipt_items").delete().eq("receipt_id", id);
        if (deleteError) throw deleteError;
        if (patch.items.length > 0) {
          const { error: insertError } = await client.from("receipt_items").insert(
            patch.items.map((item) => ({
              receipt_id: id,
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total_price: item.totalPrice,
            })),
          );
          if (insertError) throw insertError;
        }
      }
      if (patch.recognition) {
        const { error: aiError } = await client.from("ai_processing").insert({
          receipt_id: id,
          provider: patch.recognition.provider,
          model: patch.recognition.model,
          processing_status: patch.recognition.needsReview ? "needs_review" : "ok",
          confidence: patch.recognition.confidence,
          error_message: patch.recognition.reviewReason,
        });
        if (aiError) throw aiError;
      }
      const updated = await this.getReceipt(id);
      if (!updated) throw new Error("Чек не найден");
      return updated;
    },
    async deleteReceipt(id) {
      const session = await this.getSession();
      if (session?.role !== "admin") {
        throw new Error("Удалять чек может только заказчик");
      }
      const receipt = await this.getReceipt(id);
      if (!receipt) throw new Error("Чек не найден");
      const folder = `${receipt.userId}/${receipt.id}`;
      await removeStoredFiles(client, "receipt-photos", folder);
      await removeStoredFiles(client, "receipt-audio", folder);
      const { error } = await client.from("receipts").delete().eq("id", id);
      if (error) {
        const message = error.message || "";
        if (message.toLowerCase().includes("row-level security") || error.code === "42501") {
          throw new Error(
            "База ещё не разрешает удаление. В Supabase откройте SQL Editor и выполните правило receipts_delete_admin из файла supabase/schema.sql.",
          );
        }
        throw new Error(message || "Не удалось удалить чек");
      }
    },
  };
}

async function removeStoredFiles(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  bucket: string,
  folder: string,
) {
  const { data, error } = await client.storage.from(bucket).list(folder);
  if (error || !data?.length) return;
  const paths = data.filter((file) => file.name).map((file) => `${folder}/${file.name}`);
  if (paths.length === 0) return;
  await client.storage.from(bucket).remove(paths);
}
