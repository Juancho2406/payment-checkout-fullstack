# docs

Contrato de la kata (objetivo). Nest, Prisma y Vite **aún no** están: estos markdowns se implementan en slices posteriores.

| Archivo | Qué cubre |
|---|---|
| [`architecture.drawio`](architecture.drawio) | Topología: Compose local vs AWS (CloudFront/S3, ALB, ECS Fargate, RDS). **Sin Lambda.** |
| [`architecture.md`](architecture.md) | Narrativa: hexágono, ROP, qué corre dónde |
| [`data-model.md`](data-model.md) | Producto, cliente, transacción, entrega. Sin PAN. Prisma pendiente. |
| [`api-contract.md`](api-contract.md) | REST previsto (OpenAPI en markdown). Endpoints marcados como no implementados. |

ADRs, si hacen falta, llegan cuando una decisión deje de caber en estos tres archivos.
