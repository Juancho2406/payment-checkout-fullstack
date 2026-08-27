export type ProductSeed = {
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
};

export const productSeedData: readonly ProductSeed[] = [
  {
    name: "Auriculares inalámbricos",
    description: "Over-ear Bluetooth con cancelación de ruido. Producto dummy del catálogo.",
    priceCents: 12990000,
    stock: 8,
    imageUrl: "https://picsum.photos/seed/checkout-headphones/640/640",
  },
  {
    name: "Teclado mecánico",
    description: "Switch táctil, layout español. Producto dummy del catálogo.",
    priceCents: 24990000,
    stock: 4,
    imageUrl: "https://picsum.photos/seed/checkout-keyboard/640/640",
  },
];
