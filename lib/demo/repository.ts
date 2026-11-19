import { statusAfterRecognition } from "@/lib/ai/assess";
import { recognizeReceiptPhotos } from "@/lib/ai/client";
import { DEFAULT_CURRENCY, toAuthEmail } from "@/lib/config";
import { fileToDataUrl } from "@/lib/files";
import {
  DEMO_ADMIN_ID,
  demoCategories,
  demoReceipts,
  demoUsers,
} from "@/lib/demo/seed";
import { assertStatusChange, builderMayDeleteReceipt, notificationKindForChange, notificationText } from "@/lib/payments";
import type { AppRepository } from "@/lib/data/repository";
import type { AppNotification, NotificationKind, Profile, Receipt, WorkCategory } from "@/types";

const DEMO_VERSION = "4";

const KEYS = {
  version: "otchet.version",
  users: "otchet.users",
  session: "otchet.session",
  categories: "otchet.categories",
  receipts: "otchet.receipts",
  payments: "otchet.payments",
  notifications: "otchet.notifications",
};

type StoredUser = Profile & { password: string };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error(
      "Не хватило места в браузере. Сделайте фото поменьше или короче голосовое сообщение.",
    );
  }
}

function ensureSeed() {
  if (localStorage.getItem(KEYS.version) === DEMO_VERSION) return;
  writeJson(KEYS.users, demoUsers);
  writeJson(KEYS.categories, demoCategories);
  writeJson(KEYS.receipts, demoReceipts);
  localStorage.setItem(KEYS.version, DEMO_VERSION);
}

function withCategoryNames(receipts: Receipt[], categories: WorkCategory[]) {
  return receipts.map((receipt) => {
    const category = categories.find((item) => item.id === receipt.categoryId);
    return category ? { ...receipt, categoryName: category.name } : receipt;
  });
}

function publicProfile(user: StoredUser): Profile {
  const { password: _password, ...profile } = user;
  void _password;
  return profile;
}

export function createDemoRepository(): AppRepository {
  const listeners = new Set<(profile: Profile | null) => void>();

  function emit(profile: Profile | null) {
    listeners.forEach((listener) => listener(profile));
  }

  return {
    async getSession() {
      ensureSeed();
      const sessionId = localStorage.getItem(KEYS.session);
      if (!sessionId) return null;
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      const user = users.find((item) => item.id === sessionId);
      return user ? publicProfile(user) : null;
    },
    async signIn(login, password) {
      ensureSeed();
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      const normalized = login.trim().toLowerCase();
      const user = users.find(
        (item) =>
          item.login.toLowerCase() === normalized ||
          item.email.toLowerCase() === normalized ||
          item.email.toLowerCase() === toAuthEmail(login),
      );
      if (!user || user.password !== password) {
        throw new Error("Неверный логин или пароль");
      }
      localStorage.setItem(KEYS.session, user.id);
      const profile = publicProfile(user);
      emit(profile);
      return profile;
    },
    async signUp(name, login, password) {
      ensureSeed();
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      const email = toAuthEmail(login);
      const exists = users.some(
        (item) =>
          item.login.toLowerCase() === login.trim().toLowerCase() ||
          item.email.toLowerCase() === email,
      );
      if (exists) throw new Error("Такой логин уже занят");
      const hasAdmin = users.some((item) => item.role === "admin");
      const user: StoredUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email,
        login: login.trim().toLowerCase(),
        role: hasAdmin ? "builder" : "admin",
        createdAt: new Date().toISOString(),
        password,
      };
      writeJson(KEYS.users, [...users, user]);
      localStorage.setItem(KEYS.session, user.id);
      const profile = publicProfile(user);
      emit(profile);
      return profile;
    },
    async signInWithGoogle() {
      throw new Error("В демо-режиме вход через Google недоступен");
    },
    async signOut() {
      localStorage.removeItem(KEYS.session);
      emit(null);
    },
    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    async listUsers() {
      ensureSeed();
      return readJson<StoredUser[]>(KEYS.users, demoUsers).map(publicProfile);
    },
    async listCategories() {
      ensureSeed();
      return readJson<WorkCategory[]>(KEYS.categories, demoCategories);
    },
    async createCategory(input) {
      const categories = await this.listCategories();
      const category: WorkCategory = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description.trim(),
        isActive: input.isActive,
        createdAt: new Date().toISOString(),
      };
      writeJson(KEYS.categories, [...categories, category]);
      return category;
    },
    async updateCategory(id, input) {
      const categories = await this.listCategories();
      const next = categories.map((category) =>
        category.id === id
          ? {
              ...category,
              name: input.name.trim(),
              description: input.description.trim(),
              isActive: input.isActive,
            }
          : category,
      );
      writeJson(KEYS.categories, next);
      const updated = next.find((category) => category.id === id);
      if (!updated) throw new Error("Категория не найдена");
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      writeJson(KEYS.receipts, withCategoryNames(receipts, next));
      return updated;
    },
    async deleteCategory(id) {
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      if (receipts.some((receipt) => receipt.categoryId === id)) {
        throw new Error("Нельзя удалить вид работ, к которому уже привязаны чеки. Можно его отключить.");
      }
      const categories = await this.listCategories();
      writeJson(
        KEYS.categories,
        categories.filter((category) => category.id !== id),
      );
    },
    async listReceipts(scope) {
      ensureSeed();
      const categories = await this.listCategories();
      const receipts = withCategoryNames(
        readJson<Receipt[]>(KEYS.receipts, demoReceipts),
        categories,
      );
      if (scope === "all") {
        return receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      const session = await this.getSession();
      return receipts
        .filter((receipt) => receipt.userId === session?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getReceipt(id) {
      const receipts = await this.listReceipts("all");
      const receipt = receipts.find((item) => item.id === id) ?? null;
      const session = await this.getSession();
      if (!receipt) return null;
      if (session?.role === "builder" && receipt.userId !== session.id) return null;
      return receipt;
    },
    async createReceipt(input) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      if (session.role !== "builder") {
        throw new Error("Новые чеки добавляет строитель");
      }
      const categories = await this.listCategories();
      const category = categories.find((item) => item.id === input.categoryId);
      if (!category) throw new Error("Выберите вид работ");
      let recognition = null;
      try {
        recognition = await recognizeReceiptPhotos(input.photos);
      } catch {
        recognition = null;
      }
      const photos = await Promise.all(
        input.photos.map(async (file) => ({
          id: crypto.randomUUID(),
          url: await fileToDataUrl(file),
        })),
      );
      const now = new Date().toISOString();
      const receipt: Receipt = {
        id: crypto.randomUUID(),
        userId: session.id,
        userName: session.name,
        categoryId: category.id,
        categoryName: category.name,
        storeName: recognition?.storeName ?? null,
        receiptDate: recognition?.receiptDate ?? null,
        receiptNumber: recognition?.receiptNumber ?? null,
        totalAmount: recognition?.totalAmount ?? null,
        currency: recognition?.currency ?? DEFAULT_CURRENCY,
        status: recognition
          ? statusAfterRecognition("pending_review", recognition.needsReview)
          : "pending_review",
        commentText: input.commentText.trim() || null,
        audioUrl: input.audio ? await fileToDataUrl(input.audio) : null,
        audioTranscription: input.audioTranscript?.trim() || null,
        images: photos,
        items: (recognition?.items ?? []).map((item) => ({
          id: crypto.randomUUID(),
          ...item,
        })),
        recognition: recognition
          ? {
              provider: recognition.provider,
              model: recognition.model,
              confidence: recognition.confidence,
              needsReview: recognition.needsReview,
              reviewReason: recognition.reviewReason,
            }
          : null,
        createdAt: now,
        updatedAt: now,
      };
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      writeJson(KEYS.receipts, [receipt, ...receipts]);
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      notifyUsers(users.filter((user) => user.role === "admin").map((user) => user.id), "receipt_created", receipt);
      return receipt;
    },
    async updateReceipt(id, patch) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      const current = receipts.find((receipt) => receipt.id === id);
      if (!current) throw new Error("Чек не найден");
      if (session.role !== "admin") {
        const keys = Object.keys(patch);
        if (keys.some((key) => key !== "status")) {
          throw new Error("Изменять чек может только заказчик");
        }
      }
      assertStatusChange(session.role, session.id, current, patch.status);
      const categories = await this.listCategories();
      const payments = readJson<Array<{
        id: string;
        receiptId: string;
        userId: string;
        previousStatus: string;
        newStatus: string;
        createdAt: string;
      }>>(KEYS.payments, []);
      const next = receipts.map((receipt) => {
        if (receipt.id !== id) return receipt;
        const category = patch.categoryId
          ? categories.find((item) => item.id === patch.categoryId)
          : null;
        if (patch.status && patch.status !== receipt.status && session) {
          payments.push({
            id: crypto.randomUUID(),
            receiptId: receipt.id,
            userId: session.id,
            previousStatus: receipt.status,
            newStatus: patch.status,
            createdAt: new Date().toISOString(),
          });
        }
        return {
          ...receipt,
          ...patch,
          categoryName: category?.name ?? receipt.categoryName,
          updatedAt: new Date().toISOString(),
        };
      });
      writeJson(KEYS.payments, payments);
      writeJson(KEYS.receipts, next);
      const updated = next.find((receipt) => receipt.id === id);
      if (!updated) throw new Error("Чек не найден");
      if (patch.status && patch.status !== current.status) {
        const kind = notificationKindForChange(session.role, current.status, patch.status);
        if (kind === "payment_requested" || kind === "payment_cancelled") {
          notifyUsers([updated.userId], kind, updated);
        }
        if (kind === "payment_rejected") {
          const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
          notifyUsers(users.filter((user) => user.role === "admin").map((user) => user.id), kind, updated);
        }
        if (current.status === "awaiting_confirmation") closePaymentRequests(updated.id);
      }
      return updated;
    },
    async listNotifications() {
      const session = await this.getSession();
      if (!session) return [];
      closeStalePaymentRequests();
      return readJson<AppNotification[]>(KEYS.notifications, [])
        .filter((item) => item.userId === session.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async markNotificationRead(id) {
      const session = await this.getSession();
      const items = readJson<AppNotification[]>(KEYS.notifications, []);
      writeJson(
        KEYS.notifications,
        items.map((item) =>
          item.id === id && item.userId === session?.id && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    async markAllNotificationsRead() {
      const session = await this.getSession();
      const items = readJson<AppNotification[]>(KEYS.notifications, []);
      const now = new Date().toISOString();
      writeJson(
        KEYS.notifications,
        items.map((item) => (item.userId === session?.id && !item.readAt ? { ...item, readAt: now } : item)),
      );
    },
    async deleteReceipt(id) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      const current = receipts.find((receipt) => receipt.id === id);
      if (!current) throw new Error("Чек не найден");
      if (session.role !== "admin") {
        if (session.id !== current.userId || !builderMayDeleteReceipt(current.status)) {
          throw new Error("Этот чек уже нельзя удалить: заказчик отметил оплату");
        }
      }
      writeJson(
        KEYS.receipts,
        receipts.filter((receipt) => receipt.id !== id),
      );
      const notes = readJson<AppNotification[]>(KEYS.notifications, []);
      writeJson(
        KEYS.notifications,
        notes.filter((item) => item.receiptId !== id),
      );
      const payments = readJson<Array<{ receiptId: string }>>(KEYS.payments, []);
      writeJson(
        KEYS.payments,
        payments.filter((payment) => payment.receiptId !== id),
      );
    },
  };
}

export function resetDemoData() {
  localStorage.removeItem(KEYS.version);
  localStorage.removeItem(KEYS.users);
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem(KEYS.categories);
  localStorage.removeItem(KEYS.receipts);
  localStorage.removeItem(KEYS.payments);
  localStorage.removeItem(KEYS.notifications);
  void DEMO_ADMIN_ID;
}

function closeStalePaymentRequests() {
  const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
  const open = new Set(
    receipts.filter((receipt) => receipt.status === "awaiting_confirmation").map((receipt) => receipt.id),
  );
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  const stale = items.some(
    (item) => item.kind === "payment_requested" && !item.readAt && !open.has(item.receiptId),
  );
  if (!stale) return;
  const now = new Date().toISOString();
  writeJson(
    KEYS.notifications,
    items.map((item) =>
      item.kind === "payment_requested" && !item.readAt && !open.has(item.receiptId)
        ? { ...item, readAt: now }
        : item,
    ),
  );
}

function closePaymentRequests(receiptId: string) {
  const now = new Date().toISOString();
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  writeJson(
    KEYS.notifications,
    items.map((item) =>
      item.receiptId === receiptId && item.kind === "payment_requested" && !item.readAt
        ? { ...item, readAt: now }
        : item,
    ),
  );
}

function notifyUsers(userIds: string[], kind: NotificationKind, receipt: Receipt) {
  const text = notificationText(kind, receipt);
  const now = new Date().toISOString();
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  writeJson(KEYS.notifications, [
    ...userIds.map((userId) => ({
      id: crypto.randomUUID(),
      userId,
      receiptId: receipt.id,
      kind,
      title: text.title,
      body: text.body,
      readAt: null,
      createdAt: now,
    })),
    ...items,
  ]);
}
