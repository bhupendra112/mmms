import { GroupMaster } from "../model/index.js";
import { calculateDemandDetails } from "../controller/admin/recoveryController.js";

/**
 * Calculate member exit position (read-only). Uses only calculateDemandDetails.
 * No DB writes. Returns receivable, payable, net, direction, and demandSnapshot.
 * Always computes from current demand; does not short-circuit if a settlement record exists.
 * Caller must check for existing MemberExitSettlement before allowing create.
 *
 * @param {string} groupId - Group ID
 * @param {string} memberId - Member ID
 * @param {Date} exitDate - Date as of which to compute position
 * @returns {Promise<{ receivable: number, payable: number, net: number, direction: string, demandSnapshot: object|null }>}
 */
export async function calculateMemberExitPosition(groupId, memberId, exitDate) {
    const groupDoc = await GroupMaster.findById(groupId).lean();
    if (!groupDoc) {
        throw new Error("Group not found");
    }

    const demandDetails = await calculateDemandDetails(
        groupId,
        memberId,
        { amounts: {} },
        exitDate,
        groupDoc,
        1
    );

    const receivable =
        (demandDetails.saving?.closingBalance ?? 0) +
        (demandDetails.fd?.closingBalance ?? 0);

    const payable =
        (demandDetails.loan?.unpaidDemand ?? 0) +
        (demandDetails.interest?.unpaidDemand ?? 0) +
        (demandDetails.yogdan?.unpaidDemand ?? 0) +
        (demandDetails.memFeesSHG?.unpaidDemand ?? 0) +
        (demandDetails.memFeesGroup?.unpaidDemand ?? 0) +
        (demandDetails.penalty?.unpaidDemand ?? 0) +
        (demandDetails.charges?.unpaidDemandTotal ?? 0);

    const net = Math.round((receivable - payable) * 100) / 100;
    const direction =
        net > 0 ? "GROUP_PAYS" : net < 0 ? "MEMBER_PAYS" : "SETTLED";

    return {
        receivable,
        payable,
        net,
        direction,
        demandSnapshot: demandDetails,
    };
}
