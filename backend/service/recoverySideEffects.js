/**
 * ONLY WRITER / POST-PERSIST: yogdan marks, MemberRevenueDemand payment splits,
 * cash/bank transactions, ledger postings. Called after immutable snapshot save.
 */

import LoanMaster from "../model/LoanMaster.js";
import Member from "../model/Member.js";
import MemberRevenueDemand from "../model/MemberRevenueDemand.js";
import GroupMaster from "../model/GroupMaster.js";
import { createBankTransactionRecord } from "../utility/bankTransactionHelper.js";
import { createCashTransactionRecord } from "../utility/cashTransactionHelper.js";
import { postTransaction } from "./ledgerPostingService.js";
import { findOrCreateHead } from "../utility/headMappingHelper.js";

/**
 * Process recovery transactions after RecoveryMaster is persisted.
 */
export async function processRecoveryTransactions(
    recovery,
    groupDoc,
    parsedDate,
    createdBy = "admin",
    options = {}
) {
    if (!recovery.recoveries || !Array.isArray(recovery.recoveries)) {
        return;
    }

    const skipCashBankCreation = options.skipCashBankCreation === true;

    for (const memberRecovery of recovery.recoveries) {
        if (!memberRecovery.total || memberRecovery.total === 0) {
            const amounts = memberRecovery.amounts || {};
            const chargesTotal = amounts.charges
                ? Object.values(amounts.charges).reduce(
                      (sum, amount) => sum + (amount || 0),
                      0
                  )
                : 0;

            memberRecovery.total =
                (amounts.saving || 0) +
                (amounts.loan || 0) +
                (amounts.interest || 0) +
                (amounts.yogdan || 0) +
                (amounts.memFeesSHG || 0) +
                (amounts.memFeesSamiti || 0) +
                (amounts.memFeesGroup || 0) +
                (amounts.penalty || 0) +
                (amounts.other || 0) +
                (amounts.fd || 0) +
                chargesTotal;
        }

        if (memberRecovery.amounts?.yogdan > 0 && memberRecovery.memberId) {
            let remainingYogdan = memberRecovery.amounts.yogdan;
            if (remainingYogdan > 0) {
                const memberLoans = await LoanMaster.find({
                    groupId: groupDoc._id,
                    memberId: memberRecovery.memberId.toString(),
                    transactionType: "Loan",
                    status: "approved",
                    yogdanCollected: false,
                    date: { $lte: parsedDate },
                })
                    .sort({ date: 1 })
                    .lean();

                for (const loan of memberLoans) {
                    if (remainingYogdan <= 0) break;
                    const loanAmount = loan.amount || 0;
                    const hasStored =
                        loan.yogdanAmount !== undefined &&
                        loan.yogdanAmount !== null;
                    const yogdanAmount = hasStored
                        ? parseFloat(loan.yogdanAmount) || 0
                        : Math.round(loanAmount * 0.01 * 100) / 100;
                    if (remainingYogdan >= yogdanAmount) {
                        await LoanMaster.findByIdAndUpdate(loan._id, {
                            yogdanCollected: true,
                            yogdanCollectedDate: parsedDate,
                        });
                        remainingYogdan -= yogdanAmount;
                    }
                }
            }
        }

        if (memberRecovery.amounts?.loan > 0 && memberRecovery.memberId) {
            const member = await Member.findById(memberRecovery.memberId);
            if (member && member.loanDetails) {
                const hasLoanMasterEntries = await LoanMaster.findOne({
                    groupId: groupDoc._id,
                    memberId: memberRecovery.memberId.toString(),
                    transactionType: "Loan",
                    status: "approved",
                }).lean();

                if (!hasLoanMasterEntries) {
                    if (!member.loanDetails.loanPaid) {
                        member.loanDetails.loanPaid = 0;
                    }
                    member.loanDetails.loanPaid =
                        (member.loanDetails.loanPaid || 0) +
                        memberRecovery.amounts.loan;
                    await member.save();
                }
            }
        }

        if (memberRecovery.amounts?.memFeesSHG > 0 && memberRecovery.memberId) {
            const member = await Member.findById(memberRecovery.memberId);
            if (member) {
                member.lastMembershipPaidDate = parsedDate;
                await member.save();
            }

            const unpaidMemFeesDemands = await MemberRevenueDemand.find({
                memberId: memberRecovery.memberId,
                groupId: groupDoc._id,
                revenueType: "membership_fees_shg",
                isPaid: false,
            }).sort({ isAnnualDemand: 1, demandDate: 1 });

            let remainingPayment =
                parseFloat(memberRecovery.amounts.memFeesSHG) || 0;
            for (const demand of unpaidMemFeesDemands) {
                if (remainingPayment <= 0) break;
                const demandAmount = parseFloat(demand.amount) || 0;
                const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                const remainingDemand = Math.max(
                    0,
                    demandAmount - currentPaidAmount
                );
                const paymentForThisDemand = Math.min(
                    remainingPayment,
                    remainingDemand
                );
                const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                demand.paidAmount = newPaidAmount;
                demand.paidDate = parsedDate;
                demand.recoveryId = recovery._id;
                if (newPaidAmount >= demandAmount) {
                    demand.isPaid = true;
                }
                await demand.save();
                remainingPayment -= paymentForThisDemand;
            }
        }

        if (memberRecovery.amounts?.memFeesGroup > 0 && memberRecovery.memberId) {
            const member = await Member.findById(memberRecovery.memberId);
            if (member) {
                member.lastMembershipGroupPaidDate = parsedDate;
                await member.save();
            }

            const unpaidMemGroupDemands = await MemberRevenueDemand.find({
                memberId: memberRecovery.memberId,
                groupId: groupDoc._id,
                revenueType: "membership_fees_group",
                isPaid: false,
            }).sort({ isAnnualDemand: 1, demandDate: 1 });

            let remainingPayment =
                parseFloat(memberRecovery.amounts.memFeesGroup) || 0;
            for (const demand of unpaidMemGroupDemands) {
                if (remainingPayment <= 0) break;
                const demandAmount = parseFloat(demand.amount) || 0;
                const currentPaidAmount = parseFloat(demand.paidAmount) || 0;
                const remainingDemand = Math.max(
                    0,
                    demandAmount - currentPaidAmount
                );
                const paymentForThisDemand = Math.min(
                    remainingPayment,
                    remainingDemand
                );
                const newPaidAmount = currentPaidAmount + paymentForThisDemand;

                demand.paidAmount = newPaidAmount;
                demand.paidDate = parsedDate;
                demand.recoveryId = recovery._id;
                if (newPaidAmount >= demandAmount) {
                    demand.isPaid = true;
                }
                await demand.save();
                remainingPayment -= paymentForThisDemand;
            }
        }

        if (
            !skipCashBankCreation &&
            memberRecovery.paymentMode?.online &&
            memberRecovery.bankId &&
            memberRecovery.total > 0
        ) {
            await createBankTransactionRecord({
                bankId: memberRecovery.bankId,
                groupId: groupDoc._id,
                transactionType: "recovery",
                amount: memberRecovery.total || 0,
                date: parsedDate,
                onlineRef: memberRecovery.onlineRef || null,
                receipt: memberRecovery.screenshot || null,
                description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                recoveryId: recovery._id,
                recoveryMemberId: memberRecovery.memberId,
                memberId: memberRecovery.memberId,
                memberCode: memberRecovery.memberCode,
                memberName: memberRecovery.memberName,
                createdBy,
            });
        }

        if (!skipCashBankCreation) {
            const isCashPayment =
                memberRecovery.paymentMode?.cash === true ||
                memberRecovery.paymentMode?.cash === "true" ||
                (typeof memberRecovery.paymentMode === "object" &&
                    memberRecovery.paymentMode?.cash);
            if (isCashPayment && memberRecovery.total > 0) {
                try {
                    await createCashTransactionRecord({
                        groupId: groupDoc._id,
                        transactionType: "recovery",
                        amount: memberRecovery.total || 0,
                        date: parsedDate,
                        receipt: memberRecovery.screenshot || null,
                        description: `Recovery payment - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        recoveryId: recovery._id,
                        recoveryMemberId: memberRecovery.memberId,
                        memberId: memberRecovery.memberId,
                        memberCode: memberRecovery.memberCode,
                        memberName: memberRecovery.memberName,
                        createdBy,
                    });
                } catch (cashError) {
                    console.error(
                        "[processRecoveryTransactions] cash tx:",
                        cashError
                    );
                }
            }
        }

        const amounts = memberRecovery.amounts || {};
        const paymentMode = memberRecovery.paymentMode?.cash
            ? "Cash"
            : memberRecovery.paymentMode?.online
              ? "Bank"
              : "Cash";
        const bankId = memberRecovery.bankId || undefined;
        const memberId = memberRecovery.memberId || undefined;

        if (amounts.saving > 0) {
            const headInfo = await findOrCreateHead(groupDoc._id, "Saving", "assets");
            await postTransaction({
                sourceDoc: recovery,
                headName: "Saving",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "assets",
                amount: amounts.saving,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Saving recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.loan > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Loan Recover",
                "assets"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Loan Recover",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "assets",
                amount: amounts.loan,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Loan recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.interest > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Interest Income",
                "income"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Interest Income",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "income",
                amount: amounts.interest,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Interest recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
            if (memberId) {
                try {
                    const memb = await Member.findById(memberId);
                    const odRaw = memb?.loanDetails?.overdueInterest;
                    const od =
                        odRaw !== undefined &&
                        odRaw !== null &&
                        String(odRaw).trim() !== ""
                            ? Math.max(0, parseFloat(odRaw) || 0)
                            : 0;
                    if (memb?.loanDetails && od > 0) {
                        const pay = Math.max(
                            0,
                            parseFloat(amounts.interest || 0) || 0
                        );
                        const reduce = Math.min(pay, od);
                        memb.loanDetails.overdueInterest =
                            Math.round((od - reduce) * 100) / 100;
                        await memb.save();
                    }
                } catch (e) {
                    console.error(
                        "[processRecoveryTransactions] overdueInterest after interest payment:",
                        e
                    );
                }
            }
        }

        if (amounts.yogdan > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Yogdan Recover",
                "liability"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Yogdan Recover",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "liability",
                amount: amounts.yogdan,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Yogdan recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.memFeesSHG > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Member Fee",
                "income"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Member Fee",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "income",
                amount: amounts.memFeesSHG,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Member Fee SHG - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.memFeesSamiti > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Member Fee",
                "income"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Member Fee",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "income",
                amount: amounts.memFeesSamiti,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Member Fee Samiti - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.memFeesGroup > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Member Fee Group",
                "income"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Member Fee Group",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "income",
                amount: amounts.memFeesGroup,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Member Fee Group - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        const penaltyAmount = parseFloat(amounts.penalty || 0) || 0;
        if (penaltyAmount > 0) {
            const headInfo = await findOrCreateHead(
                groupDoc._id,
                "Penalty from members",
                "income"
            );
            await postTransaction({
                sourceDoc: recovery,
                headName: "Penalty from members",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "income",
                amount: penaltyAmount,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `Penalty recovery - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.fd > 0) {
            const headInfo = await findOrCreateHead(groupDoc._id, "FD", "assets");
            await postTransaction({
                sourceDoc: recovery,
                headName: "FD",
                headType: headInfo?.headType || "groupMaster",
                headId: headInfo?.headId,
                section: "assets",
                amount: amounts.fd,
                direction: "in",
                groupId: groupDoc._id,
                memberId,
                date: parsedDate,
                notes: `FD deposit - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                paymentMode,
                bankId,
                referenceModel: "RecoveryMaster",
                referenceId: recovery._id,
                createdBy,
            });
        }

        if (amounts.charges && typeof amounts.charges === "object") {
            const group = await GroupMaster.findById(groupDoc._id).lean();
            const groupCharges = group?.charges || [];
            for (const [chargeName, chargeAmount] of Object.entries(
                amounts.charges
            )) {
                if (chargeAmount > 0) {
                    const chargeDef = groupCharges.find((c) => c.name === chargeName);
                    const chargeSection = chargeDef?.entryType || "expense";
                    await postTransaction({
                        sourceDoc: recovery,
                        headName: chargeName,
                        headType: "groupMaster",
                        headId: chargeDef?._id,
                        section: chargeSection,
                        amount: chargeAmount,
                        direction: "in",
                        groupId: groupDoc._id,
                        memberId,
                        date: parsedDate,
                        notes: `Charge: ${chargeName} - Member: ${memberRecovery.memberName} (${memberRecovery.memberCode})`,
                        paymentMode,
                        bankId,
                        referenceModel: "RecoveryMaster",
                        referenceId: recovery._id,
                        createdBy,
                    });
                }
            }
        }
    }
}
