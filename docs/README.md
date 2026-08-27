# docs

Contrato de la kata. Nest, Prisma, Vite y Swagger (`/docs`) están en el repo.

| Archivo | Qué cubre |
|---|---|
| [`architecture.drawio`](architecture.drawio) | Topología: Compose local vs AWS (CloudFront/S3, ALB, ECS Fargate, RDS). **Sin Lambda.** |
| [`architecture.md`](architecture.md) | Narrativa: hexágono, ROP, qué corre dónde |
| [`data-model.md`](data-model.md) | Producto, cliente, transacción, entrega. Sin PAN. |
| [`api-contract.md`](api-contract.md) | REST. El contrato vivo es Swagger en `/docs`. |

ADRs, si hacen falta, llegan cuando una decisión deje de caber en estos tres archivos.
