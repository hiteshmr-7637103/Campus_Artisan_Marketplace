// Categories come from GET /categories; this only adds an icon per known slug.
export const CATEGORY_EMOJI = {
  jewelry: "💍",
  decor: "🪴",
  textiles: "🧵",
  pottery: "🏺",
  other: "✨",
};

export const ORDER_STATUS_LABEL = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const LISTING_STATUS_LABEL = {
  pending_review: "In review",
  active: "Live",
  sold: "Sold",
  rejected: "Rejected",
  archived: "Archived",
};

// Display-only estimate. The real rate lives in the backend's app_config (seeded from COMMISSION_RATE)
// and every order records the rate it used — keep this in sync if the pilot rate changes.
export const PILOT_COMMISSION_RATE = 0.1;
