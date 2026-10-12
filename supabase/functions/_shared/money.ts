// Commission math — single source of truth, mirrors the listings_public view.
//
// The artisan enters the amount they want to RECEIVE (price_artisan, in paise).
// The platform adds its commission on top; the buyer pays the total.

export interface Amounts {
  amountArtisan: number;    // paise the artisan receives
  amountCommission: number; // paise the platform keeps
  amountTotal: number;      // paise the buyer pays
}

export function computeAmounts(priceArtisanPaise: number, commissionRate: number): Amounts {
  const amountArtisan = Math.round(priceArtisanPaise);
  const amountCommission = Math.round(amountArtisan * commissionRate);
  return {
    amountArtisan,
    amountCommission,
    amountTotal: amountArtisan + amountCommission,
  };
}
