export type Role = "buyer" | "seller" | "admin";
export type SellerStatus = "none" | "pending" | "approved" | "rejected";
export type ListingStatus = "pending_review" | "active" | "sold" | "rejected" | "archived";
export type OrderStatus = "pending_payment" | "paid" | "fulfilled" | "cancelled" | "refunded";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  seller_status: SellerStatus;
  email_verified: boolean;
}

export interface Category { id: string; name: string; slug: string }

export interface SellerBrief {
  id: string;
  display_name: string;
  avg_rating: number | null;
  review_count: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price_paise: number;
  category: string;
  category_slug: string;
  images: string[];
  seller: SellerBrief;
  created_at: string;
}

export interface ListingPage { items: Listing[]; page: number; page_size: number; total: number }

export interface Review {
  id: string;
  rating: number;
  comment: string;
  buyer_name: string;
  listing_title: string;
  created_at: string;
}

export interface SellerProfile {
  id: string;
  display_name: string;
  bio: string;
  avg_rating: number | null;
  review_count: number;
  reviews: Review[];
  listings: Listing[];
}

export interface SellerContact { display_name: string; phone: string; instagram: string | null }

export interface Order {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  seller_id: string;
  seller_name: string;
  amount_paise: number;
  status: OrderStatus;
  needs_refund: boolean;
  payment_url: string | null;
  seller_contact: SellerContact | null;
  reviewed: boolean;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
}

export interface SellerMe {
  seller_status: SellerStatus;
  display_name: string | null;
  bio: string | null;
  phone: string | null;
  instagram: string | null;
  upi_id: string | null;
}

export interface SellerImage { id: string; url: string; position: number }

export interface SellerListing {
  id: string;
  title: string;
  description: string;
  price_paise: number;
  category_id: string;
  category: string;
  status: ListingStatus;
  reject_reason: string | null;
  images: SellerImage[];
  created_at: string;
}

export interface SellerOrder {
  id: string;
  listing_title: string;
  amount_paise: number;
  seller_amount_paise: number;
  status: OrderStatus;
  needs_refund: boolean;
  buyer_name: string | null;
  buyer_phone: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
}

export interface SellerPayout {
  id: string;
  order_id: string;
  amount_paise: number;
  status: "pending" | "paid";
  upi_txn_ref: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface AdminSeller {
  id: string; email: string; full_name: string; seller_status: SellerStatus;
  display_name: string | null; bio: string | null; phone: string | null;
  instagram: string | null; upi_id: string | null; created_at: string;
}

export interface AdminListing {
  id: string; title: string; description: string; price_paise: number; category: string;
  status: ListingStatus; reject_reason: string | null; seller_id: string; seller_name: string;
  images: string[]; created_at: string;
}

export interface AdminOrder {
  id: string; listing_id: string; listing_title: string; buyer_name: string; buyer_email: string;
  seller_id: string; seller_name: string; amount_paise: number; commission_paise: number;
  seller_amount_paise: number; status: OrderStatus; needs_refund: boolean;
  created_at: string; paid_at: string | null; fulfilled_at: string | null;
}

export interface AdminPayout {
  id: string; order_id: string; seller_id: string; seller_name: string; upi_id: string | null;
  amount_paise: number; status: "pending" | "paid"; upi_txn_ref: string | null;
  paid_at: string | null; created_at: string;
}

export interface Metrics {
  signups: number; verified_signups: number; active_sellers: number; listings_active: number;
  listings_total: number; checkouts_started: number; paid_orders: number; gmv_paise: number;
  commission_paise: number;
}
