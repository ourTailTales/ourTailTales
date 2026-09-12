import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/order";

export type OrderView = {
  id: string;
  status: OrderStatus;
  email: string | null;
  petName: string | null;
  chapterCount: number;
  storyPages: number;
  totalPages: number;
  bookPrice: number;
  shippingPrice: number | null;
  luluPrintJobId: string | null;
  luluStatusMessage: string | null;
  reviewReason: string | null;
  hasPrintFiles: boolean;
  createdAt: string;
};

/** Server-only read. Never exposes storage paths or Stripe identifiers. */
export async function readOrder(orderId: string): Promise<OrderView | null> {
  if (!supabaseConfigured()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;

  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(
      "id, status, email, pet_name, chapter_count, story_pages, total_pages, book_price, shipping_price, lulu_print_job_id, lulu_status_message, review_reason, interior_path, cover_path, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    status: data.status as OrderStatus,
    email: data.email,
    petName: data.pet_name,
    chapterCount: data.chapter_count,
    storyPages: data.story_pages,
    totalPages: data.total_pages,
    bookPrice: Number(data.book_price),
    shippingPrice:
      data.shipping_price === null ? null : Number(data.shipping_price),
    luluPrintJobId: data.lulu_print_job_id,
    luluStatusMessage: data.lulu_status_message,
    reviewReason: data.review_reason,
    hasPrintFiles: Boolean(data.interior_path && data.cover_path),
    createdAt: data.created_at,
  };
}
