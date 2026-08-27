import { err, ok, type Result } from "../../domain/result";
import {
  transactionNotFound,
  type CheckoutTransaction,
  type TransactionNotFoundError,
  type TransactionRepository,
} from "../../domain/transaction";

export class GetTransactionQuery {
  constructor(private readonly transactions: TransactionRepository) {}

  async execute(
    id: string,
  ): Promise<Result<CheckoutTransaction, TransactionNotFoundError>> {
    const transaction = await this.transactions.findById(id);
    if (!transaction) {
      return err(transactionNotFound(id));
    }
    return ok(transaction);
  }
}
