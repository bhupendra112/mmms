/**
 * Original opening saving (before any admin adjustments) for ledger display.
 * openingSaving stores the current value; adjustments store the deltas.
 * original = current openingSaving - sum(adjustments)
 * @param {Object} member - Member doc or plain object with openingSaving and openingSavingAdjustments
 * @returns {number}
 */
export function getOriginalOpeningSaving(member) {
    if (!member) return 0;
    const current = Number(member.openingSaving) || 0;
    const adjustments = member.openingSavingAdjustments || [];
    const sum = adjustments.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return current - sum;
}
