import { statusAfterRecognition } from "@/lib/ai/assess";
import { recognizeReceiptPhotos } from "@/lib/ai/client";
import { assertCategoryAllowed } from "@/lib/categories";
import { DEFAULT_CURRENCY, toAuthEmail } from "@/lib/config";
import { fileToDataUrl } from "@/lib/files";
import {
  DEMO_ADMIN_ID,
  demoCategories,
  demoReceipts,
  demoUsers,
} from "@/lib/demo/seed";
import { assertStatusChange, builderMayDeleteReceipt, builderMayDeleteWork, notificationKindForChange, notificationText, workNotificationText } from "@/lib/payments";
import type { AppRepository } from "@/lib/data/repository";
import type { AppNotification, NotificationKind, Profile, Receipt, WorkCategory, WorkRecord } from "@/types";

const DEMO_VERSION = "4";

const KEYS = {
  version: "otchet.version",
  users: "otchet.users",
  session: "otchet.session",
  categories: "otchet.categories",
  receipts: "otchet.receipts",
  works: "otchet.works",
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
    async signUp(name, login, password, role) {
      ensureSeed();
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      const email = toAuthEmail(login);
      const exists = users.some(
        (item) =>
          item.login.toLowerCase() === login.trim().toLowerCase() ||
          item.email.toLowerCase() === email,
      );
      if (exists) throw new Error("Такой логин уже занят");
      const user: StoredUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email,
        login: login.trim().toLowerCase(),
        role,
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
      return readJson<WorkCategory[]>(KEYS.categories, demoCategories).map((category) => ({
        ...category,
        assigneeIds: category.assigneeIds ?? [],
      }));
    },
    async createCategory(input) {
      const categories = await this.listCategories();
      const category: WorkCategory = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description.trim(),
        isActive: input.isActive,
        assigneeIds: input.assigneeIds,
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
              assigneeIds: input.assigneeIds,
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
      const categories = await this.listCategories();
      const category = assertCategoryAllowed(categories, session.role, session.id, input.categoryId);
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
        storeName: null,
        receiptDate: null,
        receiptNumber: null,
        totalAmount: null,
        currency: DEFAULT_CURRENCY,
        status: session.role === "admin" ? "paid" : "pending_review",
        commentText: input.commentText.trim() || null,
        audioUrl: input.audio ? await fileToDataUrl(input.audio) : null,
        audioTranscription: input.audioTranscript?.trim() || null,
        images: photos,
        items: [],
        recognition: null,
        createdAt: now,
        updatedAt: now,
      };
      const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
      writeJson(KEYS.receipts, [receipt, ...receipts]);
      if (session.role !== "admin") {
        const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
        notifyUsers(users.filter((user) => user.role === "admin").map((user) => user.id), "receipt_created", receipt);
      }
      void fillDemoRecognition(receipt.id, input.photos);
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
    async listWorks(scope) {
      ensureSeed();
      const categories = await this.listCategories();
      const works = readJson<WorkRecord[]>(KEYS.works, []).map((work) => ({
        ...work,
        categoryName: categories.find((category) => category.id === work.categoryId)?.name ?? work.categoryName,
      }));
      const sorted = works.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      if (scope === "all") return sorted;
      const session = await this.getSession();
      return sorted.filter((work) => work.userId === session?.id);
    },
    async getWork(id) {
      const works = await this.listWorks("all");
      const work = works.find((item) => item.id === id) ?? null;
      const session = await this.getSession();
      if (!work || !session) return null;
      if (session.role === "builder" && work.userId !== session.id) return null;
      return work;
    },
    async createWork(input) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const categories = await this.listCategories();
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      const masterId = session.role === "admin" ? input.userId : session.id;
      const master = users.find((user) => user.id === masterId && user.role === "builder");
      if (!master) throw new Error("Выберите мастера");
      const category = assertCategoryAllowed(categories, "builder", master.id, input.categoryId);
      if (!category.assigneeIds.includes(master.id)) throw new Error("Этот вид работ не назначен выбранному мастеру");
      const photos = await Promise.all(
        input.photos.map(async (file) => ({ id: crypto.randomUUID(), url: await fileToDataUrl(file) })),
      );
      const now = new Date().toISOString();
      const work: WorkRecord = {
        id: crypto.randomUUID(),
        userId: master.id,
        userName: master.name,
        createdById: session.id,
        categoryId: category.id,
        categoryName: category.name,
        title: input.title.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        totalAmount: input.totalAmount,
        currency: DEFAULT_CURRENCY,
        progress: "planned",
        status: "unpaid",
        commentText: input.commentText.trim() || null,
        audioUrl: input.audio ? await fileToDataUrl(input.audio) : null,
        audioTranscription: input.audioTranscript?.trim() || null,
        images: photos,
        createdAt: now,
        updatedAt: now,
      };
      writeJson(KEYS.works, [work, ...readJson<WorkRecord[]>(KEYS.works, [])]);
      if (session.role === "admin") notifyAboutWork([master.id], "work_assigned", work);
      else notifyAboutWork(users.filter((user) => user.role === "admin").map((user) => user.id), "work_created", work);
      return work;
    },
    async updateWork(id, patch) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const works = readJson<WorkRecord[]>(KEYS.works, []);
      const current = works.find((work) => work.id === id);
      if (!current) throw new Error("Работа не найдена");
      if (session.role === "builder" && session.id !== current.userId) throw new Error("Это не ваша работа");
      assertStatusChange(session.role, session.id, current, patch.status);
      if (session.role === "builder" && patch.progress && patch.progress !== current.progress && patch.progress !== "done") {
        throw new Error("Можно только отметить работу выполненной");
      }
      const details = ["title", "startDate", "endDate", "totalAmount", "commentText", "categoryId", "audioTranscription"] as const;
      const changesDetails = details.some((key) => key in patch);
      if (session.role === "builder" && changesDetails && !builderMayDeleteWork(current)) {
        throw new Error("Эту работу уже нельзя менять");
      }
      const categories = await this.listCategories();
      const extraPhotos = patch.photos
        ? await Promise.all(patch.photos.map(async (file) => ({ id: crypto.randomUUID(), url: await fileToDataUrl(file) })))
        : [];
      const next = works.map((work) => {
        if (work.id !== id) return work;
        const category = patch.categoryId ? categories.find((item) => item.id === patch.categoryId) : null;
        const nextWork: WorkRecord = {
          ...work,
          title: patch.title ?? work.title,
          startDate: "startDate" in patch ? patch.startDate ?? null : work.startDate,
          endDate: "endDate" in patch ? patch.endDate ?? null : work.endDate,
          totalAmount: "totalAmount" in patch ? patch.totalAmount ?? null : work.totalAmount,
          commentText: "commentText" in patch ? patch.commentText ?? null : work.commentText,
          audioTranscription: "audioTranscription" in patch ? patch.audioTranscription ?? null : work.audioTranscription,
          categoryId: patch.categoryId ?? work.categoryId,
          progress: patch.progress ?? work.progress,
          status: patch.status ?? work.status,
          images: [...work.images, ...extraPhotos],
          categoryName: category?.name ?? work.categoryName,
          updatedAt: new Date().toISOString(),
        };
        return nextWork;
      });
      writeJson(KEYS.works, next);
      const updated = next.find((work) => work.id === id);
      if (!updated) throw new Error("Работа не найдена");
      const users = readJson<StoredUser[]>(KEYS.users, demoUsers);
      if (patch.progress === "done" && current.progress !== "done") {
        notifyAboutWork(users.filter((user) => user.role === "admin").map((user) => user.id), "work_completed", updated);
      }
      if (patch.status && patch.status !== current.status) {
        const kind = notificationKindForChange(session.role, current.status, patch.status);
        if (kind === "payment_requested" || kind === "payment_cancelled") notifyAboutWork([updated.userId], kind, updated);
        if (kind === "payment_rejected") {
          notifyAboutWork(users.filter((user) => user.role === "admin").map((user) => user.id), kind, updated);
        }
        if (current.status === "awaiting_confirmation") closePaymentRequests(null, updated.id);
      }
      return updated;
    },
    async deleteWork(id) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const works = readJson<WorkRecord[]>(KEYS.works, []);
      const current = works.find((work) => work.id === id);
      if (!current) throw new Error("Работа не найдена");
      if (session.role !== "admin" && (session.id !== current.userId || !builderMayDeleteWork(current))) {
        throw new Error("Эту работу уже нельзя удалить");
      }
      writeJson(KEYS.works, works.filter((work) => work.id !== id));
      const notes = readJson<AppNotification[]>(KEYS.notifications, []);
      writeJson(KEYS.notifications, notes.filter((item) => item.workId !== id));
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
    async deleteNotification(id) {
      const session = await this.getSession();
      if (!session) throw new Error("Нужно войти в систему");
      const items = readJson<AppNotification[]>(KEYS.notifications, []);
      writeJson(
        KEYS.notifications,
        items.filter((item) => item.id !== id || item.userId !== session.id),
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
  localStorage.removeItem(KEYS.works);
  localStorage.removeItem(KEYS.payments);
  localStorage.removeItem(KEYS.notifications);
  void DEMO_ADMIN_ID;
}

function closeStalePaymentRequests() {
  const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
  const works = readJson<WorkRecord[]>(KEYS.works, []);
  const openReceipts = new Set(
    receipts.filter((receipt) => receipt.status === "awaiting_confirmation").map((receipt) => receipt.id),
  );
  const openWorks = new Set(
    works.filter((work) => work.status === "awaiting_confirmation").map((work) => work.id),
  );
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  const stale = items.some(
    (item) =>
      item.kind === "payment_requested" &&
      !item.readAt &&
      ((item.receiptId && !openReceipts.has(item.receiptId)) || (item.workId && !openWorks.has(item.workId))),
  );
  if (!stale) return;
  const now = new Date().toISOString();
  writeJson(
    KEYS.notifications,
    items.map((item) =>
      item.kind === "payment_requested" &&
      !item.readAt &&
      ((item.receiptId && !openReceipts.has(item.receiptId)) || (item.workId && !openWorks.has(item.workId)))
        ? { ...item, readAt: now }
        : item,
    ),
  );
}

function closePaymentRequests(receiptId: string | null, workId: string | null = null) {
  const now = new Date().toISOString();
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  writeJson(
    KEYS.notifications,
    items.map((item) =>
      item.kind === "payment_requested" &&
      !item.readAt &&
      ((receiptId && item.receiptId === receiptId) || (workId && item.workId === workId))
        ? { ...item, readAt: now }
        : item,
    ),
  );
}

async function fillDemoRecognition(receiptId: string, photos: File[]) {
  let recognition = null;
  try {
    recognition = await recognizeReceiptPhotos(photos);
  } catch {
    recognition = null;
  }
  if (!recognition) return;
  const receipts = readJson<Receipt[]>(KEYS.receipts, demoReceipts);
  const current = receipts.find((receipt) => receipt.id === receiptId);
  if (!current || current.recognition) return;
  const nextStatus =
    current.status === "pending_review"
      ? statusAfterRecognition("pending_review", recognition.needsReview)
      : current.status;
  writeJson(
    KEYS.receipts,
    receipts.map((receipt) =>
      receipt.id === receiptId
        ? {
            ...receipt,
            storeName: recognition.storeName,
            receiptDate: recognition.receiptDate,
            receiptNumber: recognition.receiptNumber,
            totalAmount: recognition.totalAmount,
            currency: recognition.currency,
            status: nextStatus,
            items: recognition.items.map((item) => ({ id: crypto.randomUUID(), ...item })),
            recognition: {
              provider: recognition.provider,
              model: recognition.model,
              confidence: recognition.confidence,
              needsReview: recognition.needsReview,
              reviewReason: recognition.reviewReason,
            },
            updatedAt: new Date().toISOString(),
          }
        : receipt,
    ),
  );
}

function notifyAboutWork(userIds: string[], kind: NotificationKind, work: WorkRecord) {
  const text = workNotificationText(kind, work);
  const now = new Date().toISOString();
  const items = readJson<AppNotification[]>(KEYS.notifications, []);
  writeJson(KEYS.notifications, [
    ...userIds.map((userId) => ({
      id: crypto.randomUUID(),
      userId,
      receiptId: null,
      workId: work.id,
      kind,
      title: text.title,
      body: text.body,
      readAt: null,
      createdAt: now,
    })),
    ...items,
  ]);
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
      workId: null,
      kind,
      title: text.title,
      body: text.body,
      readAt: null,
      createdAt: now,
    })),
    ...items,
  ]);
}
