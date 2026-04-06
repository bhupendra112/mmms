/**
 * Sort members by member code ascending (numeric-aware).
 * @param {Array} members
 * @returns {Array} new sorted array
 */
export function sortMembersAscending(members) {
    if (!Array.isArray(members)) return [];
    return [...members].sort((a, b) => {
        const ca = String(a?.Member_Id ?? "").trim();
        const cb = String(b?.Member_Id ?? "").trim();
        return ca.localeCompare(cb, "en-IN", { numeric: true, sensitivity: "base" });
    });
}

/** Father/Husband label from member doc (primary F_H_Name, else F_H_FatherName). */
export function getFatherOrHusbandLabel(m) {
    if (!m || typeof m !== "object") return "";
    return String(m.F_H_Name || m.F_H_FatherName || "").trim();
}
