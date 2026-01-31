import mongoose from "mongoose";
import { config } from "dotenv";
import { GroupLedger, RecoveryMaster, LoanMaster, FDMaster, PaymentMaster, ExpenseMaster } from "../model/index.js";
import { postTransaction } from "../service/ledgerPostingService.js";
import { findOrCreateHead } from "../utility/headMappingHelper.js";

config();

/**
 * Backfill script to create ledger entries from existing transactions
 * This is a one-time migration script
 * 
 * Usage: node backend/script/backfillLedger.js [groupId]
 * If groupId is provided, only backfill that group. Otherwise, backfill all groups.
 */
async function backfillLedger(groupId = null) {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mmms");
        console.log("Connected to MongoDB");

        const filter = groupId ? { _id: groupId } : {};
        const groups = await mongoose.model("GroupMaster").find(filter).lean();

        console.log(`Found ${groups.length} group(s) to process`);

        let totalProcessed = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const group of groups) {
            console.log(`\nProcessing group: ${group.group_name} (${group._id})`);

            // 1. Backfill RecoveryMaster entries
            const recoveries = await RecoveryMaster.find({ groupId: group._id }).lean();
            console.log(`  Found ${recoveries.length} recovery sessions`);

            for (const recovery of recoveries) {
                if (recovery.recoveries && Array.isArray(recovery.recoveries)) {
                    for (const memberRecovery of recovery.recoveries) {
                        const amounts = memberRecovery.amounts || {};
                        const paymentMode = memberRecovery.paymentMode?.cash ? "Cash" : (memberRecovery.paymentMode?.online ? "Bank" : "Cash");

                        // RecoveryMaster has multiple ledger entries per recovery (one per head per member). postTransaction dedupes by (referenceModel, referenceId, headName, memberId).

                        try {
                            // Post saving
                            if (amounts.saving > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Saving", "assets");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Saving",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "assets",
                                    amount: amounts.saving,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Saving recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post loan recovery
                            if (amounts.loan > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Loan Recover", "assets");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Loan Recover",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "assets",
                                    amount: amounts.loan,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Loan recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post interest income
                            if (amounts.interest > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Interest Income", "income");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Interest Income",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "income",
                                    amount: amounts.interest,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Interest recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post yogdan recover
                            if (amounts.yogdan > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Yogdan Recover", "liability");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Yogdan Recover",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "liability",
                                    amount: amounts.yogdan,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Yogdan recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post member fees
                            if (amounts.memFeesSHG > 0 || amounts.memFeesSamiti > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Member Fee", "income");
                                const totalFees = (amounts.memFeesSHG || 0) + (amounts.memFeesSamiti || 0);
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Member Fee",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "income",
                                    amount: totalFees,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Member Fee - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post member fee group
                            if (amounts.memFeesGroup > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Member Fee Group", "income");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Member Fee Group",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "income",
                                    amount: amounts.memFeesGroup,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Member Fee Group - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post penalty (income)
                            if (parseFloat(amounts.penalty || 0) > 0) {
                                const headInfo = await findOrCreateHead(group._id, "Penalty from members", "income");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "Penalty from members",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "income",
                                    amount: amounts.penalty,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `Penalty recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            // Post FD
                            if (amounts.fd > 0) {
                                const headInfo = await findOrCreateHead(group._id, "FD", "assets");
                                await postTransaction({
                                    sourceDoc: recovery,
                                    headName: "FD",
                                    headType: headInfo?.headType || "groupMaster",
                                    headId: headInfo?.headId,
                                    section: "assets",
                                    amount: amounts.fd,
                                    direction: "in",
                                    groupId: group._id,
                                    memberId: memberRecovery.memberId,
                                    date: recovery.date,
                                    notes: `FD deposit - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                                    paymentMode,
                                    bankId: memberRecovery.bankId || undefined,
                                    referenceModel: "RecoveryMaster",
                                    referenceId: recovery._id,
                                    createdBy: "backfill-script",
                                });
                            }

                            totalProcessed++;
                        } catch (error) {
                            console.error(`    Error processing recovery ${recovery._id}:`, error.message);
                            totalErrors++;
                        }
                    }
                }
            }

            // 2. Backfill LoanMaster entries (approved loans only)
            const loans = await LoanMaster.find({
                groupId: group._id,
                transactionType: "Loan",
                status: "approved"
            }).lean();
            console.log(`  Found ${loans.length} approved loans`);

            for (const loan of loans) {
                const existing = await GroupLedger.findOne({
                    referenceModel: "LoanMaster",
                    referenceId: loan._id
                });

                if (existing) {
                    totalSkipped++;
                    continue;
                }

                try {
                    const headInfo = await findOrCreateHead(group._id, "Loan Distribute", "liability");
                    await postTransaction({
                        sourceDoc: loan,
                        headName: "Loan Distribute",
                        headType: headInfo?.headType || "groupMaster",
                        headId: headInfo?.headId,
                        section: "liability",
                        amount: loan.amount,
                        direction: "out",
                        groupId: group._id,
                        memberId: loan.memberId || undefined,
                        date: loan.date,
                        notes: `Loan distribution - ${loan.purpose || ""} - Member: ${loan.memberName || loan.memberCode || ""}`,
                        paymentMode: loan.paymentMode || "Cash",
                        bankId: loan.bankId || undefined,
                        referenceModel: "LoanMaster",
                        referenceId: loan._id,
                        createdBy: "backfill-script",
                    });
                    totalProcessed++;
                } catch (error) {
                    console.error(`    Error processing loan ${loan._id}:`, error.message);
                    totalErrors++;
                }
            }

            // 3. Backfill FDMaster entries
            const fds = await FDMaster.find({ groupId: group._id }).lean();
            console.log(`  Found ${fds.length} FDs`);

            for (const fd of fds) {
                const existing = await GroupLedger.findOne({
                    referenceModel: "FDMaster",
                    referenceId: fd._id
                });

                if (existing) {
                    totalSkipped++;
                    continue;
                }

                try {
                    const headInfo = await findOrCreateHead(group._id, "FD", "assets");
                    await postTransaction({
                        sourceDoc: fd,
                        headName: "FD",
                        headType: headInfo?.headType || "groupMaster",
                        headId: headInfo?.headId,
                        section: "assets",
                        amount: fd.amount,
                        direction: "in",
                        groupId: group._id,
                        memberId: fd.memberId,
                        date: fd.date,
                        notes: `FD creation - Amount: ₹${fd.amount} - Member: ${fd.memberName} (${fd.memberCode})`,
                        paymentMode: fd.paymentMode?.online ? "Bank" : "Cash",
                        bankId: fd.bankId || undefined,
                        referenceModel: "FDMaster",
                        referenceId: fd._id,
                        createdBy: "backfill-script",
                    });
                    totalProcessed++;
                } catch (error) {
                    console.error(`    Error processing FD ${fd._id}:`, error.message);
                    totalErrors++;
                }
            }

            // 4. Backfill PaymentMaster entries (approved/completed payments)
            const payments = await PaymentMaster.find({
                groupId: group._id,
                status: { $in: ["approved", "completed"] }
            }).lean();
            console.log(`  Found ${payments.length} payments`);

            for (const payment of payments) {
                const existing = await GroupLedger.findOne({
                    referenceModel: "PaymentMaster",
                    referenceId: payment._id
                });

                if (existing) {
                    totalSkipped++;
                    continue;
                }

                try {
                    if (payment.paymentType === "saving_withdrawal") {
                        const headInfo = await findOrCreateHead(group._id, "Saving Return", "liability");
                        await postTransaction({
                            sourceDoc: payment,
                            headName: "Saving Return",
                            headType: headInfo?.headType || "groupMaster",
                            headId: headInfo?.headId,
                            section: "liability",
                            amount: payment.amount,
                            direction: "out",
                            groupId: group._id,
                            memberId: payment.memberId,
                            date: payment.paymentDate,
                            notes: `Saving withdrawal - Member: ${payment.memberName} (${payment.memberCode})`,
                            paymentMode: payment.paymentMode || "Cash",
                            bankId: payment.bankId || undefined,
                            referenceModel: "PaymentMaster",
                            referenceId: payment._id,
                            createdBy: "backfill-script",
                        });
                    } else if (payment.paymentType === "fd_maturity") {
                        const headInfo = await findOrCreateHead(group._id, "FD Return", "liability");
                        await postTransaction({
                            sourceDoc: payment,
                            headName: "FD Return",
                            headType: headInfo?.headType || "groupMaster",
                            headId: headInfo?.headId,
                            section: "liability",
                            amount: payment.amount,
                            direction: "out",
                            groupId: group._id,
                            memberId: payment.memberId,
                            date: payment.paymentDate,
                            notes: `FD maturity payment - Amount: ₹${payment.amount} - Member: ${payment.memberName} (${payment.memberCode})`,
                            paymentMode: payment.paymentMode || "Cash",
                            bankId: payment.bankId || undefined,
                            referenceModel: "PaymentMaster",
                            referenceId: payment._id,
                            createdBy: "backfill-script",
                        });
                    }
                    totalProcessed++;
                } catch (error) {
                    console.error(`    Error processing payment ${payment._id}:`, error.message);
                    totalErrors++;
                }
            }

            // 5. Backfill ExpenseMaster entries
            const expenses = await ExpenseMaster.find({ groupId: group._id }).lean();
            console.log(`  Found ${expenses.length} expenses`);

            for (const expense of expenses) {
                const existing = await GroupLedger.findOne({
                    referenceModel: "ExpenseMaster",
                    referenceId: expense._id
                });

                if (existing) {
                    totalSkipped++;
                    continue;
                }

                try {
                    const direction = expense.entryType === "income" ? "in" : "out";
                    await postTransaction({
                        sourceDoc: expense,
                        headName: expense.expenseType,
                        headType: "expenseMaster",
                        headId: expense._id,
                        section: expense.entryType,
                        amount: expense.amount,
                        direction: direction,
                        groupId: group._id,
                        memberId: undefined,
                        date: expense.date,
                        notes: `Expense - ${expense.expenseType}: ${expense.purpose || ""}`,
                        paymentMode: expense.paymentMode || "Cash",
                        bankId: expense.bankId || undefined,
                        referenceModel: "ExpenseMaster",
                        referenceId: expense._id,
                        createdBy: "backfill-script",
                    });
                    totalProcessed++;
                } catch (error) {
                    console.error(`    Error processing expense ${expense._id}:`, error.message);
                    totalErrors++;
                }
            }
        }

        console.log(`\n=== Backfill Summary ===`);
        console.log(`Total processed: ${totalProcessed}`);
        console.log(`Total skipped (already exists): ${totalSkipped}`);
        console.log(`Total errors: ${totalErrors}`);

        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");

    } catch (error) {
        console.error("Backfill error:", error);
        process.exit(1);
    }
}

// Run backfill
const groupId = process.argv[2] || null;
backfillLedger(groupId);
