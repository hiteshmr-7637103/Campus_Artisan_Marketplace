export type Category = "jewelry" | "decor" | "textiles" | "pottery" | "other";
export type ListingStatus = "pending" | "active" | "sold" | "rejected";
export type OrderStatus = "placed" | "paid" | "fulfilled" | "cancelled";
export type FulfillmentMethod = "pickup" | "delivery";

export const CATEGORIES: Category[] = ["jewelry", "decor", "textiles", "pottery", "other"];

export const CATEGORY_LABEL: Record<Category, string> = {
  jewelry: "Jewelry",
  decor: "Decor",
  textiles: "Textiles",
  pottery: "Pottery",
  other: "Other",
};

// Row from the buyer-facing `listings_public` view — NO contact fields exist here.
export interface PublicListing {
  id: string;
  category: Category;
  title: string;
  description: string;
  photo_urls: string[];
  status: ListingStatus;
  created_at: string;
  artisan_id: string | null;
  artisan_name: string | null;
  price_buyer: number; // paise
  artisan_review_count: number;
  artisan_avg_rating: number | null;
}

export interface PublicReview {
  id: string;
  listing_id: string;
  artisan_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  fulfillment_method: FulfillmentMethod;
  delivery_point: string | null;
  delivery_time: string | null;
  delivery_notes: string | null;
  amount_total: number;
  listing: { id: string; title: string; category: Category; photo_urls: string[] };
  artisan: null | {
    name: string;
    contact_phone: string | null;
    contact_email: string | null;
    instagram: string | null;
    contact_raw: string | null;
  };
  can_review: boolean;
  has_review: boolean;
}

// Admin-only shapes (read straight from base tables via RLS).
export interface AdminListing {
  id: string;
  artisan_id: string | null;
  submitted_artisan_name: string;
  submitted_artisan_contact: string;
  category: Category;
  title: string;
  description: string;
  price_artisan: number;
  photo_urls: string[];
  status: ListingStatus;
  reject_reason: string | null;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  fulfillment_method: FulfillmentMethod;
  delivery_point: string | null;
  delivery_time: string | null;
  delivery_notes: string | null;
  amount_total: number;
  amount_commission: number;
  amount_artisan: number;
  status: OrderStatus;
  razorpay_payment_id: string | null;
  payout_done: boolean;
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  listings: { title: string; artisan_id: string | null } | null;
}
