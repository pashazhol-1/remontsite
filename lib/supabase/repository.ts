import { assertCategoryAllowed } from "@/lib/categories";
import { DEFAULT_CURRENCY, loginFromEmail, toAuthEmail } from "@/lib/config";
import type { AppRepository } from "@/lib/data/repository";
import { assertStatusChange, builderMayDeleteReceipt, builderMayDeleteWork, notificationKindForChange } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppNotification, Profile, Receipt, ReceiptImage, ReceiptItem, UserRole, WorkCategory, WorkRecord } from "@/types";
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
  assignee_ids?: string[] | null;
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

function mapCategory(row: CategoryRow): WorkCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    isActive: row.is_active,
    assigneeIds: Array.isArray(row.assignee_ids) ? row.assignee_ids : [],
    createdAt: row.created_at,
  };
}

function worksSqlHint(message: string) {
  if (
    message.includes("assignee_ids") ||
    message.includes("public.works") ||
    message.includes("relation") && message.includes("works") ||
    message.includes("notify_work_event") ||
    message.includes("schema cache")
  ) {
    return "Работы ещё не включены в базе. В Supabase откройте SQL Editor и выполните файл supabase/works.sql";
  }
  return message;
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

type WorkRow = {
  id: string;
  user_id: string;
  created_by: string;
  category_id: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  total_amount: number | string | null;
  currency: string | null;
  progress: WorkRecord["progress"];
  status: WorkRecord["status"];
  comment_text: string | null;
  audio_url: string | null;
  audio_transcription: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { name: string } | { name: string }[] | null;
  work_categories?: { name: string } | { name: string }[] | null;
  work_images?: { id: string; storage_path: string }[];
};

async function mapWork(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  row: WorkRow,
): Promise<WorkRecord> {
  const images = await Promise.all(
    (row.work_images ?? []).map(async (image) => ({
      id: image.id,
      path: image.storage_path,
      url: (await signedUrl(client, "receipt-photos", image.storage_path)) ?? "",
    })),
  );
  return {
    id: row.id,
    userId: row.user_id,
    userName: nestedName(row.profiles) || "Мастер",
    createdById: row.created_by,
    categoryId: row.category_id ?? "",
    categoryName: nestedName(row.work_categories) || "Без категории",
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    totalAmount: row.total_amount === null ? null : Number(row.total_amount),
    currency: row.currency ?? DEFAULT_CURRENCY,
    progress: row.progress,
    status: row.status,
    commentText: row.comment_text,
    audioUrl: await signedUrl(client, "receipt-audio", row.audio_url),
    audioTranscription: row.audio_transcription,
    images: images.filter((image) => image.url),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function uploadWorkFiles(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  ownerId: string,
  workId: string,
  photos: File[],
  audio: Blob | null,
) {
  const { count } = await client
    .from("work_images")
    .select("id", { count: "exact", head: true })
    .eq("work_id", workId);
  const start = count ?? 0;
  for (const [index, file] of photos.entries()) {
    const path = `${ownerId}/works/${workId}/${start + index}-${file.name}`;
    const { error: uploadError } = await client.storage.from("receipt-photos").upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { error: rowError } = await client.from("work_images").insert({
      work_id: workId,
      storage_path: path,
      sort_order: start + index,
    });
    if (rowError) throw rowError;
  }
  if (audio) {
    const audioPath = `${ownerId}/works/${workId}/comment.webm`;
    const { error: audioError } = await client.storage
      .from("receipt-audio")
      .upload(audioPath, audio, { upsert: true, contentType: audio.type || "audio/webm" });
    if (audioError) throw audioError;
    await client.from("works").update({ audio_url: audioPath }).eq("id", workId);
  }
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
      return (data as CategoryRow[]).map(mapCategory);
    },
    async createCategory(input) {
      const { data, error } = await client
        .from("work_categories")
        .insert({
          name: input.name.trim(),
          description: input.description.trim(),
          is_active: input.isActive,
          assignee_ids: input.assigneeIds,
        })
        .select("*")
        .single();
      if (error) throw new Error(worksSqlHint(error.message));
      return mapCategory(data as CategoryRow);
    },
    async updateCategory(id, input) {
      const { data, error } = await client
        .from("work_categories")
        .update({
          name: input.name.trim(),
          description: input.description.trim(),
          is_active: input.isActive,
          assignee_ids: input.assigneeIds,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(worksSqlHint(error.message));
      return mapCategory(data as CategoryRow);
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
      const categories = await this.listCategories();
      assertCategoryAllowed(categories, session.role, session.id, input.categoryId);
      const { data: receipt, error } = await client
        .from("receipts")
        .insert({
          user_id: session.id,
          category_id: input.categoryId,
          comment_text: input.commentText.trim() || null,
          audio_transcription: input.audioTranscript?.trim() || null,
          currency: DEFAULT_CURRENCY,
          status: session.role === "admin" ? "paid" : "pending_review",
        })
        .select("id")
        .single();
      if (error || !receipt) {
        const message = error?.message ?? "Не удалось сохранить чек";
        if (message.toLowerCase().includes("row-level security") || message.includes("receipts_insert")) {
          throw new Error("Заказчик пока не может сохранить чек. В Supabase ещё раз выполните файл supabase/works.sql");
        }
        throw error ?? new Error("Не удалось сохранить чек");
      }

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
      if (session.role !== "admin") await notifyReceiptEvent(client, created.id, "receipt_created");
      await fetch(`/api/receipts/${created.id}/recognize`, { method: "POST" }).catch(() => undefined);
      return created;
    },
    async updateReceipt(id, patch) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const current = await this.getReceipt(id);
      if (!current) throw new Error("Чек не найден");
      if (session.role !== "admin" && Object.keys(patch).some((key) => key !== "status")) {
        throw new Error("Изменять чек может только заказчик");
      }
      assertStatusChange(session.role, session.id, current, patch.status);
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
      if (error) throw new Error(explainReceiptWriteError(error.message));
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
      if (patch.status && patch.status !== current.status) {
        const kind = notificationKindForChange(session.role, current.status, patch.status);
        if (kind && kind !== "payment_confirmed") await notifyReceiptEvent(client, id, kind);
        if (current.status === "awaiting_confirmation") {
          await client
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("receipt_id", id)
            .eq("kind", "payment_requested")
            .is("read_at", null);
        }
      }
      return updated;
    },
    async listWorks(scope) {
      let query = client
        .from("works")
        .select("*, profiles!works_user_id_fkey(name), work_categories(name), work_images(id, storage_path)")
        .order("created_at", { ascending: false });
      if (scope === "mine") {
        const session = await this.getSession();
        if (!session) return [];
        query = query.eq("user_id", session.id);
      }
      const { data, error } = await query;
      if (error) {
        if (error.message.includes("works") || error.message.includes("schema cache")) return [];
        throw new Error(worksSqlHint(error.message));
      }
      return Promise.all((data as WorkRow[]).map((row) => mapWork(client, row)));
    },
    async getWork(id) {
      const { data, error } = await client
        .from("works")
        .select("*, profiles!works_user_id_fkey(name), work_categories(name), work_images(id, storage_path)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(worksSqlHint(error.message));
      if (!data) return null;
      return mapWork(client, data as WorkRow);
    },
    async createWork(input) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const categories = await this.listCategories();
      const users = await this.listUsers();
      const masterId = session.role === "admin" ? input.userId : session.id;
      const master = users.find((user) => user.id === masterId && user.role === "builder");
      if (!master) throw new Error("Выберите мастера");
      const category = assertCategoryAllowed(categories, "builder", master.id, input.categoryId);
      const { data: createdRow, error } = await client
        .from("works")
        .insert({
          user_id: master.id,
          created_by: session.id,
          category_id: category.id,
          title: input.title.trim(),
          start_date: input.startDate,
          end_date: input.endDate,
          total_amount: input.totalAmount,
          currency: DEFAULT_CURRENCY,
          comment_text: input.commentText.trim() || null,
          audio_transcription: input.audioTranscript?.trim() || null,
        })
        .select("id")
        .single();
      if (error || !createdRow) throw new Error(worksSqlHint(error?.message ?? "Не удалось сохранить работу"));
      const workId = createdRow.id as string;
      await uploadWorkFiles(client, master.id, workId, input.photos, input.audio);
      await notifyWorkEvent(client, workId, session.role === "admin" ? "work_assigned" : "work_created");
      const created = await this.getWork(workId);
      if (!created) throw new Error("Работа сохранена, но не удалось её прочитать");
      return created;
    },
    async updateWork(id, patch) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const current = await this.getWork(id);
      if (!current) throw new Error("Работа не найдена");
      if (session.role === "builder" && session.id !== current.userId) throw new Error("Это не ваша работа");
      assertStatusChange(session.role, session.id, current, patch.status);
      const detailKeys = ["title", "startDate", "endDate", "totalAmount", "commentText", "categoryId", "audioTranscription"] as const;
      if (session.role === "builder" && detailKeys.some((key) => key in patch) && !builderMayDeleteWork(current)) {
        throw new Error("Эту работу уже нельзя менять");
      }
      const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("categoryId" in patch) changes.category_id = patch.categoryId;
      if ("title" in patch) changes.title = patch.title?.trim();
      if ("startDate" in patch) changes.start_date = patch.startDate;
      if ("endDate" in patch) changes.end_date = patch.endDate;
      if ("totalAmount" in patch) changes.total_amount = patch.totalAmount;
      if ("commentText" in patch) changes.comment_text = patch.commentText;
      if ("audioTranscription" in patch) changes.audio_transcription = patch.audioTranscription;
      if ("progress" in patch) changes.progress = patch.progress;
      if ("status" in patch) changes.status = patch.status;
      const { error } = await client.from("works").update(changes).eq("id", id);
      if (error) throw new Error(worksSqlHint(error.message));
      if (patch.photos && patch.photos.length > 0) {
        await uploadWorkFiles(client, current.userId, id, patch.photos, null);
      }
      if (patch.progress === "done" && current.progress !== "done") {
        await notifyWorkEvent(client, id, "work_completed");
      }
      if (patch.status && patch.status !== current.status) {
        const kind = notificationKindForChange(session.role, current.status, patch.status);
        if (kind && kind !== "payment_confirmed") await notifyWorkEvent(client, id, kind);
        if (current.status === "awaiting_confirmation") {
          await client
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("work_id", id)
            .eq("kind", "payment_requested")
            .is("read_at", null);
        }
      }
      const updated = await this.getWork(id);
      if (!updated) throw new Error("Работа не найдена");
      return updated;
    },
    async deleteWork(id) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const work = await this.getWork(id);
      if (!work) throw new Error("Работа не найдена");
      if (session.role !== "admin" && (session.id !== work.userId || !builderMayDeleteWork(work))) {
        throw new Error("Эту работу уже нельзя удалить");
      }
      const { error } = await client.from("works").delete().eq("id", id);
      if (error) throw new Error(worksSqlHint(error.message));
    },
    async listNotifications() {
      await closeStalePaymentRequests(client);
      const { data, error } = await client
        .from("notifications")
        .select("id, user_id, receipt_id, work_id, kind, title, body, read_at, created_at")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? [])
        .filter((row) => row.kind !== "payment_confirmed")
        .map((row) => ({
        id: row.id as string,
        userId: row.user_id as string,
        receiptId: (row.receipt_id as string | null) ?? null,
        workId: (row.work_id as string | null) ?? null,
        kind: row.kind as AppNotification["kind"],
        title: row.title as string,
        body: row.body as string,
        readAt: (row.read_at as string | null) ?? null,
        createdAt: row.created_at as string,
      }));
    },
    async markNotificationRead(id) {
      const { error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async markAllNotificationsRead() {
      const { error } = await client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    async deleteReceipt(id) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const receipt = await this.getReceipt(id);
      if (!receipt) throw new Error("Чек не найден");
      if (session.role !== "admin") {
        if (session.id !== receipt.userId || !builderMayDeleteReceipt(receipt.status)) {
          throw new Error("Этот чек уже нельзя удалить: заказчик отметил оплату");
        }
      }
      const folder = `${receipt.userId}/${receipt.id}`;
      await removeStoredFiles(client, "receipt-photos", folder);
      await removeStoredFiles(client, "receipt-audio", folder);
      const { error } = await client.from("receipts").delete().eq("id", id);
      if (error) {
        const message = error.message || "";
        if (message.toLowerCase().includes("row-level security") || error.code === "42501") {
          throw new Error(
            "База ещё не разрешает удаление. В Supabase откройте SQL Editor и ещё раз выполните файл supabase/payment-confirmation.sql.",
          );
        }
        throw new Error(message || "Не удалось удалить чек");
      }
    },
  };
}

async function closeStalePaymentRequests(client: ReturnType<typeof createSupabaseBrowserClient>) {
  const withWork = await client
    .from("notifications")
    .select("id, receipt_id, work_id")
    .eq("kind", "payment_requested")
    .is("read_at", null);
  const loaded = withWork.error
    ? await client.from("notifications").select("id, receipt_id").eq("kind", "payment_requested").is("read_at", null)
    : withWork;
  const rows = (loaded.data ?? []) as Array<{ id: string; receipt_id: string | null; work_id?: string | null }>;
  if (rows.length === 0) return;
  const receiptIds = [...new Set(rows.map((row) => row.receipt_id).filter(Boolean))] as string[];
  const workIds = [...new Set(rows.map((row) => row.work_id).filter(Boolean))] as string[];
  const { data: receipts } = receiptIds.length
    ? await client.from("receipts").select("id, status").in("id", receiptIds)
    : { data: [] };
  const { data: works } = workIds.length
    ? await client.from("works").select("id, status").in("id", workIds)
    : { data: [] };
  const stillWaiting = new Set(
    [...((receipts ?? []) as Array<{ id: string; status: string }>), ...((works ?? []) as Array<{ id: string; status: string }>)]
      .filter((row) => row.status === "awaiting_confirmation")
      .map((row) => row.id),
  );
  const staleIds = rows
    .filter((row) => !stillWaiting.has(row.receipt_id ?? "") && !stillWaiting.has(row.work_id ?? ""))
    .map((row) => row.id);
  if (staleIds.length === 0) return;
  await client.from("notifications").update({ read_at: new Date().toISOString() }).in("id", staleIds);
}

async function notifyWorkEvent(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  workId: string,
  kind: AppNotification["kind"],
) {
  const { error } = await client.rpc("notify_work_event", {
    target_work: workId,
    event_kind: kind,
  });
  if (!error) return;
  if (error.message.includes("notify_work_event") || error.message.includes("schema cache")) {
    throw new Error("Запись сохранена, но уведомление не ушло. Выполните файл supabase/works.sql в SQL Editor Supabase.");
  }
  throw new Error(error.message);
}

function explainReceiptWriteError(message: string) {
  if (message.includes("receipts_status_check") || message.includes("awaiting_confirmation")) {
    return "База ещё не знает новый статус. В Supabase откройте SQL Editor и выполните файл supabase/payment-confirmation.sql";
  }
  return message || "Не удалось сохранить чек";
}

async function notifyReceiptEvent(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  receiptId: string,
  kind: AppNotification["kind"],
) {
  const { error } = await client.rpc("notify_receipt_event", {
    target_receipt: receiptId,
    event_kind: kind,
  });
  if (!error) return;
  if (kind === "receipt_created") return;
  if (error.message.includes("notify_receipt_event") || error.message.includes("schema cache")) {
    throw new Error("Оплата сохранена, но уведомление не ушло. Выполните файл supabase/payment-confirmation.sql в SQL Editor Supabase.");
  }
  throw new Error(error.message);
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
