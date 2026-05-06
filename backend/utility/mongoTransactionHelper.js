import mongoose from "mongoose";

/**
 * Server-side MongoDB transactions only work on a replica set or mongos.
 * Local / standalone deployments throw errors such as:
 * "Transaction numbers are only allowed on a replica set member or mongos".
 */
export function isMongoStandaloneTransactionError(err) {
    if (!err) return false;
    const msg = String(err.message || err.errmsg || "");
    return (
        /Transaction numbers are only allowed on a replica set/i.test(msg) ||
        /replica set member or mongos/i.test(msg)
    );
}

/**
 * Run multi-step persistence inside `withTransaction` when the deployment supports it.
 * On standalone MongoDB, runs the same callback with `session: null` (no atomic multi-doc rollback).
 *
 * @param {(session: import('mongoose').ClientSession | null) => Promise<void>} work
 */
export async function runWithOptionalMongoTransaction(work) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await work(session);
        });
    } catch (e) {
        if (!isMongoStandaloneTransactionError(e)) throw e;
        await work(null);
    } finally {
        await session.endSession();
    }
}
