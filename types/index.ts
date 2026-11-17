export type UserRole = "admin" | "builder";

export type ReceiptStatus = "pending_review" | "unpaid" | "paid";

export type Profile = {
  id: string;
  name: string;
  email: string;
  login: string;
  role: UserRole;
  createdAt: string;
};

export type WorkCategory = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

export type ReceiptImage = {
  id: string;
  url: string;
  path?: string;
};

export type ReceiptItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ReceiptRecognitionInfo = {
  provider: string;
  model: string;
  confidence: number | null;
  needsReview: boolean;
  reviewReason: string | null;
};

export type Receipt = {
  id: string;
  userId: string;
  userName: string;
  categoryId: string;
  categoryName: string;
  storeName: string | null;
  receiptDate: string | null;
  receiptNumber: string | null;
  totalAmount: number | null;
  currency: string;
  status: ReceiptStatus;
  commentText: string | null;
  audioUrl: string | null;
  audioTranscription: string | null;
  images: ReceiptImage[];
  items: ReceiptItem[];
  recognition: ReceiptRecognitionInfo | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptPatch = {
  categoryId?: string;
  storeName?: string | null;
  receiptDate?: string | null;
  receiptNumber?: string | null;
  totalAmount?: number | null;
  currency?: string;
  commentText?: string | null;
  audioTranscription?: string | null;
  status?: ReceiptStatus;
  items?: ReceiptItem[];
  recognition?: ReceiptRecognitionInfo | null;
};

export type CreateReceiptInput = {
  categoryId: string;
  commentText: string;
  photos: File[];
  audio: Blob | null;
  audioTranscript: string | null;
};

export type CategoryInput = {
  name: string;
  description: string;
  isActive: boolean;
};
