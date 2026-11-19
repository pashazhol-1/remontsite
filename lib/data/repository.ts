import type {
  AppNotification,
  CategoryInput,
  CreateReceiptInput,
  Profile,
  Receipt,
  ReceiptPatch,
  WorkCategory,
} from "@/types";

export type AppRepository = {
  getSession: () => Promise<Profile | null>;
  signIn: (login: string, password: string) => Promise<Profile>;
  signUp: (name: string, login: string, password: string) => Promise<Profile>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  onAuthChange: (callback: (profile: Profile | null) => void) => () => void;
  listUsers: () => Promise<Profile[]>;
  listCategories: () => Promise<WorkCategory[]>;
  createCategory: (input: CategoryInput) => Promise<WorkCategory>;
  updateCategory: (id: string, input: CategoryInput) => Promise<WorkCategory>;
  deleteCategory: (id: string) => Promise<void>;
  listReceipts: (scope: "mine" | "all") => Promise<Receipt[]>;
  getReceipt: (id: string) => Promise<Receipt | null>;
  createReceipt: (input: CreateReceiptInput) => Promise<Receipt>;
  updateReceipt: (id: string, patch: ReceiptPatch) => Promise<Receipt>;
  deleteReceipt: (id: string) => Promise<void>;
  listNotifications: () => Promise<AppNotification[]>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};
