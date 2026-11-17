export type RecognitionItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type RecognitionResult = {
  storeName: string | null;
  receiptDate: string | null;
  receiptNumber: string | null;
  currency: string;
  totalAmount: number | null;
  items: RecognitionItem[];
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
  provider: string;
  model: string;
  itemsSum: number;
};
