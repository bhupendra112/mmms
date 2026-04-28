import http from "./http";

export const downloadBankMaster = async () =>
    http.get("/admin/export/bank-master", { responseType: "blob" });

export const downloadGroupMaster = async () =>
    http.get("/admin/export/group-master", { responseType: "blob" });

export const downloadShgMemberMaster = async () =>
    http.get("/admin/export/shg-member-master", { responseType: "blob" });
