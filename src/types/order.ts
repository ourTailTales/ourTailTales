export type ShippingAddress = {
  name: string;
  phone: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postcode: string;
  country: "US";
};

export type ShippingOption = {
  level: string;
  label: string;
  price: number;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
};

export type QuoteRequest = {
  chapterCount: number;
  address: ShippingAddress;
};

export type QuoteResponse = {
  options: ShippingOption[];
  addressWarning?: string;
  suggestedAddress?: Partial<ShippingAddress>;
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "submitted"
  | "production"
  | "shipped"
  | "delivered"
  | "rejected"
  | "needs_review"
  | "canceled";

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  petName: string;
  chapterCount: number;
  storyPages: number;
  totalPages: number;
  bookPrice: number;
  shippingPrice: number;
  luluPrintJobId: string | null;
  createdAt: string;
};
