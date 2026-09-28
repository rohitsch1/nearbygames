/** Mirrors public.platform_fee() in the database: 5%, min ₹5, max ₹50. The DB is authoritative. */
export function platformFee(sharePaise: number) {
  return Math.min(Math.max(Math.round(sharePaise * 0.05), 500), 5000);
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹150 for whole rupees, ₹157.50 when there are paise. */
export function formatINR(paise: number) {
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inrPaise.format(paise / 100);
}
