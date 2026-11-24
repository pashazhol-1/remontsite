export type UserRole = "admin" | "builder";

export type ReceiptStatus = "pending_review" | "unpaid" | "awaiting_confirmation" | "paid";

export type NotificationKind =
  | "receipt_created"
  | "payment_requested"
  | "payment_confirmed"
  | "payment_rejected"
  | "payment_cancelled"
  | "work_created"
  | "work_completed"
  | "work_assigned";

export type AppNotification = {
  id: string;
  userId: string;
  receiptId: string | null;
  workId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

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
  assigneeIds: string[];
  createdAt: string;
};

export type WorkProgress = "planned" | "done";

export type WorkRecord = {
  id: string;
  userId: string;
  userName: string;
  createdById: string;
  categoryId: string;
  categoryName: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  totalAmount: number | null;
  currency: string;
  progress: WorkProgress;
  status: ReceiptStatus;
  commentText: string | null;
  audioUrl: string | null;
  audioTranscription: string | null;
  images: ReceiptImage[];
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkInput = {
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
};

export type WorkPatch = {
  categoryId?: string;
  title?: string;
  startDate?: string | null;
  endDate?: string | null;
  totalAmount?: number | null;
  commentText?: string | null;
  audioTranscription?: string | null;
  progress?: WorkProgress;
  status?: ReceiptStatus;
  photos?: File[];
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
  assigneeIds: string[];
};
