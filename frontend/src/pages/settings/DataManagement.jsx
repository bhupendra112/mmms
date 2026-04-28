import React, { useState } from "react";
import { Download } from "lucide-react";
import {
    downloadBankMaster,
    downloadGroupMaster,
    downloadShgMemberMaster,
} from "../../api/exportApi";

const DOWNLOAD_ITEMS = [
    {
        key: "bank",
        label: "Bank Master",
        fileName: "bank_master.xlsx",
        apiCall: downloadBankMaster,
    },
    {
        key: "group",
        label: "Group Master",
        fileName: "group_master.xlsx",
        apiCall: downloadGroupMaster,
    },
    {
        key: "shgMember",
        label: "SHG Member Master",
        fileName: "shg_member_master.xlsx",
        apiCall: downloadShgMemberMaster,
    },
];

export default function DataManagement({ setError, setSuccess }) {
    const [loadingState, setLoadingState] = useState({
        bank: false,
        group: false,
        shgMember: false,
    });

    const setLoading = (key, value) =>
        setLoadingState((prev) => ({ ...prev, [key]: value }));

    const downloadFile = async (apiCall, fileName, key) => {
        try {
            setError?.("");
            setSuccess?.("");
            setLoading(key, true);

            const response = await apiCall();
            const blob = new Blob([response.data], {
                type:
                    response.headers?.["content-type"] ||
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            setSuccess?.(`${fileName} downloaded successfully.`);
        } catch (error) {
            const message =
                error?.response?.data?.message || error?.message || `Failed to download ${fileName}`;
            setError?.(message);
        } finally {
            setLoading(key, false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Data Management</h2>
            <p className="text-sm text-gray-600">
                Download master datasets as Excel files for backup or external reporting.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DOWNLOAD_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => downloadFile(item.apiCall, item.fileName, item.key)}
                        disabled={loadingState[item.key]}
                        className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="text-blue-600" size={28} />
                        <span className="font-semibold text-gray-800">{item.label}</span>
                        <span className="text-sm text-gray-600">
                            {loadingState[item.key] ? "Downloading..." : `Download ${item.fileName}`}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
