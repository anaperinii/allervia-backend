import { ITransactionContext } from "./transaction.interface";

export interface ITransactionManager {
    transaction<T>(
        callback: (tx: ITransactionContext) => Promise<T>
    ): Promise<T>;
}