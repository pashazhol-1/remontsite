import { DEFAULT_CURRENCY } from "@/lib/config";
import type { Profile, Receipt, WorkCategory } from "@/types";

export const DEMO_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_BUILDER_ID = "00000000-0000-4000-8000-000000000002";

function svgReceipt(store: string, total: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560">
    <rect width="100%" height="100%" fill="#f6f4ef"/>
    <rect x="24" y="24" width="372" height="512" fill="#fff" stroke="#d6d3cd"/>
    <text x="210" y="72" text-anchor="middle" font-size="20" font-family="Arial" fill="#1c1917">${store}</text>
    <text x="210" y="100" text-anchor="middle" font-size="12" font-family="Arial" fill="#78716c">демо-чек</text>
    <line x1="48" y1="120" x2="372" y2="120" stroke="#e7e5e4"/>
    <text x="48" y="160" font-size="14" font-family="Arial" fill="#44403c">Штукатурка гипсовая</text>
    <text x="370" y="160" text-anchor="end" font-size="14" font-family="Arial" fill="#44403c">175.00</text>
    <text x="48" y="190" font-size="14" font-family="Arial" fill="#44403c">Грунтовка</text>
    <text x="370" y="190" text-anchor="end" font-size="14" font-family="Arial" fill="#44403c">48.00</text>
    <text x="48" y="220" font-size="14" font-family="Arial" fill="#44403c">Шпатель</text>
    <text x="370" y="220" text-anchor="end" font-size="14" font-family="Arial" fill="#44403c">18.00</text>
    <line x1="48" y1="250" x2="372" y2="250" stroke="#e7e5e4"/>
    <text x="48" y="290" font-size="16" font-family="Arial" fill="#1c1917">Итого</text>
    <text x="370" y="290" text-anchor="end" font-size="16" font-family="Arial" fill="#1c1917">${total} BYN</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const demoUsers: Array<Profile & { password: string }> = [
  {
    id: DEMO_ADMIN_ID,
    name: "Анна Заказчикова",
    email: "zakazchik@local.otchetstroitelya",
    login: "zakazchik",
    role: "admin",
    createdAt: "2026-10-01T09:00:00.000Z",
    password: "demo",
  },
  {
    id: DEMO_BUILDER_ID,
    name: "Иван Строителев",
    email: "stroitel@local.otchetstroitelya",
    login: "stroitel",
    role: "builder",
    createdAt: "2026-10-02T09:00:00.000Z",
    password: "demo",
  },
];

export const demoCategories: WorkCategory[] = [
  { id: "cat-plaster", name: "Штукатурка стен", description: "Черновая и чистовая штукатурка", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-putty", name: "Шпаклёвка", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-electric", name: "Электрика", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-plumbing", name: "Сантехника", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-floor", name: "Стяжка пола", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-tile", name: "Плиточные работы", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-ceiling", name: "Монтаж потолков", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-bath", name: "Отделка ванной", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-kitchen", name: "Отделка кухни", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-hall", name: "Отделка коридора", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
  { id: "cat-other", name: "Прочее", description: "", isActive: true, createdAt: "2026-10-01T09:00:00.000Z" },
];

export const demoReceipts: Receipt[] = [
  {
    id: "rec-1",
    userId: DEMO_BUILDER_ID,
    userName: "Иван Строителев",
    categoryId: "cat-plaster",
    categoryName: "Штукатурка стен",
    storeName: "Строймаркет",
    receiptDate: "2026-11-16",
    receiptNumber: "45821",
    totalAmount: 253,
    currency: DEFAULT_CURRENCY,
    status: "unpaid",
    commentText: "Это материалы для штукатурки второго этажа, покупал дополнительно грунтовку и сетку.",
    audioUrl: null,
    audioTranscription: null,
    recognition: {
      provider: "demo",
      model: "sample",
      confidence: 0.93,
      needsReview: false,
      reviewReason: null,
    },
    images: [{ id: "img-1", url: svgReceipt("Строймаркет", "253.00") }],
    items: [
      { id: "it-1", name: "Штукатурка гипсовая", quantity: 5, unitPrice: 35, totalPrice: 175 },
      { id: "it-2", name: "Грунтовка", quantity: 2, unitPrice: 24, totalPrice: 48 },
      { id: "it-3", name: "Шпатель", quantity: 1, unitPrice: 18, totalPrice: 18 },
      { id: "it-4", name: "Саморезы", quantity: 2, unitPrice: 6, totalPrice: 12 },
    ],
    createdAt: "2026-11-16T11:20:00.000Z",
    updatedAt: "2026-11-16T11:20:00.000Z",
  },
  {
    id: "rec-2",
    userId: DEMO_BUILDER_ID,
    userName: "Иван Строителев",
    categoryId: "cat-electric",
    categoryName: "Электрика",
    storeName: "Евроопт",
    receiptDate: "2026-11-15",
    receiptNumber: "12004",
    totalAmount: 180,
    currency: DEFAULT_CURRENCY,
    status: "paid",
    commentText: "Кабель и розетки для кухни.",
    audioUrl: null,
    audioTranscription: "Кабель и розетки для кухни.",
    recognition: {
      provider: "demo",
      model: "sample",
      confidence: 0.9,
      needsReview: false,
      reviewReason: null,
    },
    images: [{ id: "img-2", url: svgReceipt("Евроопт", "180.00") }],
    items: [
      { id: "it-5", name: "Кабель ВВГ 3х2.5", quantity: 20, unitPrice: 6, totalPrice: 120 },
      { id: "it-6", name: "Розетка", quantity: 4, unitPrice: 15, totalPrice: 60 },
    ],
    createdAt: "2026-11-15T16:10:00.000Z",
    updatedAt: "2026-11-15T18:00:00.000Z",
  },
  {
    id: "rec-3",
    userId: DEMO_BUILDER_ID,
    userName: "Иван Строителев",
    categoryId: "cat-plumbing",
    categoryName: "Сантехника",
    storeName: "Строймаркет",
    receiptDate: "2026-11-14",
    receiptNumber: null,
    totalAmount: 95,
    currency: DEFAULT_CURRENCY,
    status: "pending_review",
    commentText: "Фото немного смазано, нужно проверить сумму.",
    audioUrl: null,
    audioTranscription: null,
    recognition: {
      provider: "demo",
      model: "sample",
      confidence: 0.41,
      needsReview: true,
      reviewReason: "Модель не уверена в прочтении",
    },
    images: [{ id: "img-3", url: svgReceipt("Строймаркет", "95.00") }],
    items: [],
    createdAt: "2026-11-14T09:40:00.000Z",
    updatedAt: "2026-11-14T09:40:00.000Z",
  },
];
