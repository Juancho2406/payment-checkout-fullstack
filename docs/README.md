# docs

Contrato de la kata. Nest (health) existe desde `RM-10`. Prisma y Vite **aún no**.

| Archivo | Qué cubre |
|---|---|
| [`architecture.drawio`](architecture.drawio) | Topología: Compose local vs AWS (CloudFront/S3, ALB, ECS Fargate, RDS). **Sin Lambda.** |
| [`architecture.md`](architecture.md) | Narrativa: hexágono, ROP, qué corre dónde |
| [`data-model.md`](data-model.md) | Producto, cliente, transacción, entrega. Sin PAN. Prisma pendiente. |
| [`api-contract.md`](api-contract.md) | REST (OpenAPI en markdown). Health implementado; el resto marcado por slice. |

ADRs, si hacen falta, llegan cuando una decisión deje de caber en estos tres archivos.
