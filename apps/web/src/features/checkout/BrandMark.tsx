import type { CardBrand } from "../../lib/card";

export function BrandMark({ brand }: { brand: CardBrand | null }) {
  if (brand === "VISA") {
    return (
      <span className="brand-mark brand-mark--visa" aria-label="Visa">
        VISA
      </span>
    );
  }
  if (brand === "MASTERCARD") {
    return (
      <span className="brand-mark brand-mark--mc" aria-label="Mastercard">
        <span className="brand-mark__mc-dot brand-mark__mc-dot--red" />
        <span className="brand-mark__mc-dot brand-mark__mc-dot--yellow" />
      </span>
    );
  }
  return <span className="brand-mark brand-mark--empty">Tarjeta</span>;
}
