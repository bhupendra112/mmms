import React, { useEffect, useMemo, useState } from "react";
import { Building2, Users, Banknote, DollarSign, Search, Edit, Eye, Plus, TrendingUp, X, Download, FileText, CreditCard, Wallet, Trash2, Calendar, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { getGroupBanks, getGroups, getGroupDetail, getBankDetail, getCashTransactions, updateGroup, updateBank, addGroupCharge, updateGroupCharge, deleteGroupCharge, getGroupCharges } from "../../services/groupService";
import { getMembersByGroup, exportMemberLedger, updateMember, deleteMember } from "../../services/memberService";
import { getLoans } from "../../services/loanService";
import { getRecoveries, getGroupRecoveryDetails } from "../../services/recoveryService";
import { getFDsByGroup } from "../../services/fdService";
import { exportMemberLedgerToExcel, exportMemberLedgerToPDF, exportRecoveryDetailsToExcel, exportRecoveryDetailsToPDF } from "../../utils/exportUtils";

// Helper function to get full image URL
const getImageUrl = (imagePath) => {
    if (!imagePath) return null;

    // Get backend origin - extract only protocol://host:port (no API paths)
    const rawBaseURL = import.meta.env.VITE_BASE_URL || (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");

    let baseURL;
    try {
        // Try to parse as URL and extract origin (protocol://host:port)
        const url = new URL(rawBaseURL);
        baseURL = `${url.protocol}//${url.host}`; // Gets protocol://host:port
    } catch {
        // If parsing fails, extract origin manually
        const match = rawBaseURL.match(/^(https?:\/\/[^/]+)/i);
        baseURL = match ? match[1] : (import.meta.env.PROD ? "https://api.mmms.online" : "http://localhost:8080");
    }

    // If imagePath already starts with http, return as is
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        return imagePath;
    }

    // Ensure imagePath starts with /
    const cleanImagePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
    const fullUrl = `${baseURL}${cleanImagePath}`;

    return fullUrl;
};

export default function GroupManagement() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedClusterKey, setSelectedClusterKey] = useState("");
    const [activeTab, setActiveTab] = useState("overview"); // overview, members, bank, cash, finance, charges
    const [groups, setGroupsState] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedGroupData, setSelectedGroupData] = useState(null);
    const [selectedGroupRaw, setSelectedGroupRaw] = useState(null); // Store raw group data for full details
    const [groupMembers, setGroupMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [groupBanks, setGroupBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [selectedBank, setSelectedBank] = useState(null);
    const [bankTransactions, setBankTransactions] = useState([]);
    const [bankDetailLoading, setBankDetailLoading] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [cashTransactions, setCashTransactions] = useState([]);
    const [cashBalance, setCashBalance] = useState(0);
    const [cashTransactionsLoading, setCashTransactionsLoading] = useState(false);
    const [openingCashBalanceInput, setOpeningCashBalanceInput] = useState("");
    const [savingOpeningBalance, setSavingOpeningBalance] = useState(false);
    const [financeData, setFinanceData] = useState({
        totalSavings: 0,
        totalLoans: 0,
        totalFD: 0,
        totalInterest: 0,
        totalYogdan: 0,
        totalRecovery: 0,
        loading: false,
    });
    const [exportLoading, setExportLoading] = useState(false);
    const [dateRange, setDateRange] = useState({ fromDate: "", toDate: "" });
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [showEditBankModal, setShowEditBankModal] = useState(false);
    const [editingBank, setEditingBank] = useState(null);
    const [editGroupForm, setEditGroupForm] = useState({});
    const [editBankForm, setEditBankForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [groupCharges, setGroupCharges] = useState([]);
    const [chargesLoading, setChargesLoading] = useState(false);
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [editingCharge, setEditingCharge] = useState(null);
    const [chargeForm, setChargeForm] = useState({
        name: "",
        amount: "",
        type: "one-time",
        startDate: "",
        frequency: "yearly",
        isActive: true,
        entryType: "expense"
    });
    const [showEditMemberModal, setShowEditMemberModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [editMemberForm, setEditMemberForm] = useState({});
    const [recoveryDetails, setRecoveryDetails] = useState([]);
    const [recoveryDetailsLoading, setRecoveryDetailsLoading] = useState(false);
    const [selectedRecovery, setSelectedRecovery] = useState(null);

    const mapGroupToUI = (g) => {
        if (!g) return null;
        const bank = g.bankmaster || g.bank || null;
        return {
            id: g._id || g.id,
            code: g.group_code || g.code,
            name: g.group_name || g.name,
            village: g.village,
            cluster: g.cluster || g.cluster_name,
            clusterName: g.cluster_name || g.cluster || "",
            clusterCode: g.cluster_code || "",
            formationDate: g.formation_date ? new Date(g.formation_date).toLocaleDateString("en-GB") : "",
            noMembers: g.memberCount ?? g.no_members ?? 0,
            bankDetails: bank
                ? {
                    bankName: bank.bank_name,
                    accountNo: bank.account_no,
                    ifsc: bank.ifsc,
                    branch: bank.branch_name,
                }
                : null,
            members: [],
            // Finance will be calculated dynamically
        };
    };

    useEffect(() => {
        setGroupsLoading(true);
        getGroups()
            .then((res) => {
                const list = Array.isArray(res?.data) ? res.data : [];
                setGroupsState(list.map(mapGroupToUI).filter(Boolean));
            })
            .catch((e) => {
                console.error("Failed to load groups:", e);
                setGroupsState([]);
            })
            .finally(() => setGroupsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load cash transactions when cash tab is active
    useEffect(() => {
        if (activeTab === "cash" && selectedGroup) {
            loadCashTransactions(selectedGroup);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedGroup]);

    // Load recovery details when recovery-details tab is active
    useEffect(() => {
        if (activeTab === "recovery-details" && selectedGroup) {
            loadRecoveryDetails(selectedGroup);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedGroup]);

    useEffect(() => {
        if (activeTab === "cash" && selectedGroupRaw != null) {
            const val = selectedGroupRaw.opening_cash_balance;
            setOpeningCashBalanceInput(val !== undefined && val !== null ? String(val) : "");
        }
    }, [activeTab, selectedGroupRaw]);

    const clusterOptions = useMemo(() => {
        const uniqueClusters = Array.from(
            new Set(groups.map((g) => `${g.clusterName}|${g.clusterCode}`))
        );
        return uniqueClusters.map((key) => {
            const [name, code] = key.split("|");
            return { value: key, label: `${name || "No Name"} (${code || "No Code"})` };
        });
    }, [groups]);

    const filteredGroups = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!selectedClusterKey) return [];
        const [cName, cCode] = selectedClusterKey.split("|");
        const scoped = groups.filter(
            (group) => group.clusterName === cName && group.clusterCode === cCode
        );
        if (!q) return scoped;
        return scoped.filter(
            (group) =>
                (group.name || "").toLowerCase().includes(q) ||
                (group.code || "").toLowerCase().includes(q) ||
                (group.village || "").toLowerCase().includes(q)
        );
    }, [groups, searchTerm, selectedClusterKey]);

    const loadGroupDetail = async (groupId) => {
        if (!groupId) return;
        try {
            setDetailLoading(true);
            const res = await getGroupDetail(groupId);
            // Store raw data for full details
            setSelectedGroupRaw(res?.data || null);
            const mapped = mapGroupToUI(res?.data);
            if (mapped) setSelectedGroupData(mapped);
        } catch (e) {
            console.error("Failed to load group detail:", e);
        } finally {
            setDetailLoading(false);
        }
    };

    const loadGroupMembers = async (groupId) => {
        if (!groupId) return;
        try {
            setMembersLoading(true);
            const res = await getMembersByGroup(groupId);
            setGroupMembers(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load group members:", e);
            setGroupMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    const loadBanks = async (groupId) => {
        if (!groupId) return;
        try {
            setBanksLoading(true);
            const res = await getGroupBanks(groupId);
            setGroupBanks(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load banks:", e);
            setGroupBanks([]);
        } finally {
            setBanksLoading(false);
        }
    };

    const loadCashTransactions = async (groupId) => {
        try {
            setCashTransactionsLoading(true);
            const res = await getCashTransactions(groupId);
            setCashBalance(res?.data?.currentCashBalance || 0);
            setCashTransactions(res?.data?.transactions || []);
        } catch (error) {
            console.error("Failed to load cash transactions:", error);
            setCashTransactions([]);
            setCashBalance(0);
        } finally {
            setCashTransactionsLoading(false);
        }
    };

    const loadRecoveryDetails = async (groupId) => {
        if (!groupId) return;
        try {
            setRecoveryDetailsLoading(true);
            const filters = {};
            if (dateRange.fromDate) filters.fromDate = dateRange.fromDate;
            if (dateRange.toDate) filters.toDate = dateRange.toDate;
            const res = await getGroupRecoveryDetails(groupId, filters);
            if (res?.success && res?.data) {
                setRecoveryDetails(Array.isArray(res.data) ? res.data : []);
            } else {
                setRecoveryDetails([]);
            }
        } catch (error) {
            console.error("Failed to load recovery details:", error);
            setRecoveryDetails([]);
        } finally {
            setRecoveryDetailsLoading(false);
        }
    };

    const handleViewBank = async (bankId) => {
        try {
            setBankDetailLoading(true);
            setShowBankModal(true);
            const res = await getBankDetail(bankId);
            setSelectedBank(res?.data?.bank || null);
            setBankTransactions(res?.data?.transactions || []);
        } catch (error) {
            console.error("Failed to load bank detail:", error);
            alert("Failed to load bank details");
        } finally {
            setBankDetailLoading(false);
        }
    };

    const handleExportRecoveryDetails = (recovery, format) => {
        if (!recovery || !recovery.recoveries || recovery.recoveries.length === 0) {
            alert("No recovery data to export");
            return;
        }

        const groupName = selectedGroupData?.name || selectedGroupRaw?.group_name || "Group";
        const recoveryDate = new Date(recovery.date).toLocaleDateString("en-GB").replace(/\//g, "-");
        const filename = `${groupName}_Recovery_${recoveryDate}`;

        if (format === 'excel') {
            exportRecoveryDetailsToExcel(recovery.recoveries, groupName, recovery, filename);
        } else if (format === 'pdf') {
            exportRecoveryDetailsToPDF(recovery.recoveries, groupName, recovery, filename);
        }
    };

    const handleExportGroupLedger = async (format = 'excel') => {
        // Check if group is selected - selectedGroup is the ID, selectedGroupData has the full object
        const groupId = selectedGroup || selectedGroupData?.id;
        if (!groupId) {
            alert("Please select a group first");
            return;
        }

        try {
            setExportLoading(true);
            const filters = {
                groupId: groupId,
                fromDate: dateRange.fromDate || undefined,
                toDate: dateRange.toDate || undefined,
            };

            const response = await exportMemberLedger(filters);

            if (response?.success && response?.data && response.data.length > 0) {
                const groupName = selectedGroupData?.name || "Group";
                if (format === 'excel') {
                    exportMemberLedgerToExcel(response.data, `${groupName}_All_Members_Ledger`);
                } else {
                    exportMemberLedgerToPDF(response.data, `${groupName}_All_Members_Ledger`);
                }
            } else {
                alert("No ledger data found to export");
            }
        } catch (error) {
            console.error("Error exporting ledger:", error);
            alert("Failed to export ledger. Please try again.");
        } finally {
            setExportLoading(false);
        }
    };

    const handleEditGroup = () => {
        if (!selectedGroupRaw) return;
        setEditGroupForm({
            group_name: selectedGroupRaw.group_name || "",
            group_code: selectedGroupRaw.group_code || "",
            cluster_name: selectedGroupRaw.cluster_name || "",
            cluster: selectedGroupRaw.cluster || "",
            village: selectedGroupRaw.village || "",
            no_members: selectedGroupRaw.no_members || "",
            formation_date: selectedGroupRaw.formation_date ? new Date(selectedGroupRaw.formation_date).toISOString().split('T')[0] : "",
            saving_per_member: selectedGroupRaw.saving_per_member || "",
            Mship_Group: selectedGroupRaw.Mship_Group || "",
            membership_fees: selectedGroupRaw.membership_fees || "",
            mitan_name: selectedGroupRaw.mitan_name || "",
            meeting_date_1_day: selectedGroupRaw.meeting_date_1_day || "",
            meeting_date_2_day: selectedGroupRaw.meeting_date_2_day || "",
            meeting_date_2_time: selectedGroupRaw.meeting_date_2_time || "",
            sahyog_rashi: selectedGroupRaw.sahyog_rashi || "",
            shar_capital: selectedGroupRaw.shar_capital || "",
            saving_rate: selectedGroupRaw.saving_rate || "",
            fd_rate: selectedGroupRaw.fd_rate || "",
            loan_rate: selectedGroupRaw.loan_rate || "",
            opening_cash_balance: selectedGroupRaw.opening_cash_balance || "",
            govt_linked: selectedGroupRaw.govt_linked || "No",
            govt_project_type: selectedGroupRaw.govt_project_type || "",
            other: selectedGroupRaw.other || "",
            remark: selectedGroupRaw.remark || "",
            loginEnabled: selectedGroupRaw.loginEnabled !== undefined ? selectedGroupRaw.loginEnabled : true,
        });
        setShowEditGroupModal(true);
    };

    const handleSaveGroup = async () => {
        if (!selectedGroup) {
            alert("Please select a group first");
            return;
        }
        try {
            setSaving(true);
            await updateGroup(selectedGroup, editGroupForm);
            alert("Group updated successfully");
            setShowEditGroupModal(false);
            // Reload group details
            await loadGroupDetail(selectedGroup);
        } catch (error) {
            console.error("Error updating group:", error);
            alert(error?.response?.data?.message || "Failed to update group");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOpeningBalance = async () => {
        if (!selectedGroup) return;
        const parsed = parseFloat(openingCashBalanceInput, 10);
        if (Number.isNaN(parsed) || parsed < 0) {
            alert("Please enter a valid number (0 or greater).");
            return;
        }
        try {
            setSavingOpeningBalance(true);
            await updateGroup(selectedGroup, { opening_cash_balance: parsed });
            alert("Opening cash balance updated successfully");
            await loadGroupDetail(selectedGroup);
            await loadCashTransactions(selectedGroup);
            setOpeningCashBalanceInput(String(parsed));
        } catch (error) {
            console.error("Error updating opening cash balance:", error);
            alert(error?.response?.data?.message || "Failed to update opening cash balance");
        } finally {
            setSavingOpeningBalance(false);
        }
    };

    const handleEditBank = (bank) => {
        setEditingBank(bank);
        setEditBankForm({
            bank_name: bank.bank_name || "",
            account_no: bank.account_no || "",
            branch_name: bank.branch_name || "",
            ifsc: bank.ifsc || "",
            account_type: bank.account_type || "Saving",
            opening_balance: bank.opening_balance ?? "",
            cc_limit: bank.cc_limit ?? "",
            ac_open_date: bank.ac_open_date ? new Date(bank.ac_open_date).toISOString().split('T')[0] : "",
            govt_linked: bank.govt_linked || "No",
            govt_project_type: bank.govt_project_type || "",
        });
        setShowEditBankModal(true);
    };

    const handleEditMember = (member) => {
        setEditingMember(member);
        setEditMemberForm({
            Member_Id: member.Member_Id || "",
            Member_Nm: member.Member_Nm || "",
            Member_Dt: member.Member_Dt ? new Date(member.Member_Dt).toISOString().split('T')[0] : "",
            Dt_Join: member.Dt_Join ? new Date(member.Dt_Join).toISOString().split('T')[0] : "",
            F_H_Name: member.F_H_Name || "",
            F_H_FatherName: member.F_H_FatherName || "",
            Voter_Id: member.Voter_Id || "",
            Adhar_Id: member.Adhar_Id || "",
            Ration_Card: member.Ration_Card || "",
            Job_Card: member.Job_Card || "",
            Apl_Bpl_Etc: member.Apl_Bpl_Etc || "",
            Desg: member.Desg || "Member",
            Bank_Name: member.Bank_Name || "",
            Br_Name: member.Br_Name || "",
            Bank_Ac: member.Bank_Ac || "",
            Ifsc_No: member.Ifsc_No || "",
            Age: member.Age || "",
            Edu_Qual: member.Edu_Qual || "",
            Anual_Income: member.Anual_Income || "",
            Profession: member.Profession || "",
            Caste: member.Caste || "",
            Religion: member.Religion || "",
            cell_phone: member.cell_phone || "",
            dt_birth: member.dt_birth ? new Date(member.dt_birth).toISOString().split('T')[0] : "",
            nominee_1: member.nominee_1 || "",
            nominee_2: member.nominee_2 || "",
            res_add1: member.res_add1 || "",
            res_add2: member.res_add2 || "",
            Village: member.Village || "",
        });
        setShowEditMemberModal(true);
    };

    const handleSaveMember = async () => {
        if (!editingMember?._id) {
            alert("Member ID is missing");
            return;
        }
        try {
            setSaving(true);
            await updateMember(editingMember._id, editMemberForm);
            alert("Member updated successfully");
            setShowEditMemberModal(false);
            setEditingMember(null);
            // Reload members
            if (selectedGroup) {
                await loadGroupMembers(selectedGroup);
            }
        } catch (error) {
            console.error("Error updating member:", error);
            alert(error?.response?.data?.message || "Failed to update member");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMember = async (member) => {
        if (!member?._id) {
            alert("Member ID is missing");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete member ${member.Member_Id} (${member.Member_Nm})? This action cannot be undone.`)) {
            return;
        }
        try {
            setSaving(true);
            await deleteMember(member._id);
            alert("Member deleted successfully");
            // Reload members
            if (selectedGroup) {
                await loadGroupMembers(selectedGroup);
            }
        } catch (error) {
            console.error("Error deleting member:", error);
            alert(error?.response?.data?.message || "Failed to delete member");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBank = async () => {
        if (!editingBank?._id) {
            alert("Bank ID is missing");
            return;
        }
        try {
            setSaving(true);
            // Set open_bal_curr to same value as opening_balance (they are the same)
            // Set open_ind_curr to same value as open_indicator (they are the same)
            const bankUpdateData = {
                ...editBankForm,
                open_bal_curr: editBankForm.opening_balance || null,
                open_ind_curr: editBankForm.open_indicator || null,
            };
            await updateBank(editingBank._id, bankUpdateData);
            alert("Bank updated successfully");
            setShowEditBankModal(false);
            setEditingBank(null);
            // Reload banks
            if (selectedGroup) {
                await loadGroupBanks(selectedGroup);
            }
        } catch (error) {
            console.error("Error updating bank:", error);
            alert(error?.response?.data?.message || "Failed to update bank");
        } finally {
            setSaving(false);
        }
    };

    const loadGroupCharges = async (groupId) => {
        if (!groupId) return;
        try {
            setChargesLoading(true);
            const res = await getGroupCharges(groupId);
            setGroupCharges(Array.isArray(res?.data) ? res.data : []);
        } catch (error) {
            console.error("Error loading charges:", error);
            setGroupCharges([]);
        } finally {
            setChargesLoading(false);
        }
    };

    const handleAddCharge = () => {
        setEditingCharge(null);
        setChargeForm({
            name: "",
            amount: "",
            type: "one-time",
            startDate: "",
            frequency: "yearly",
            isActive: true,
            entryType: "expense"
        });
        setShowChargeModal(true);
    };

    const handleEditCharge = (charge) => {
        setEditingCharge(charge);
        setChargeForm({
            name: charge.name || "",
            amount: charge.amount || "",
            type: charge.type || "one-time",
            startDate: charge.startDate ? new Date(charge.startDate).toISOString().split('T')[0] : "",
            frequency: charge.frequency || "yearly",
            isActive: charge.isActive !== false,
            entryType: charge.entryType || "expense"
        });
        setShowChargeModal(true);
    };

    const handleSaveCharge = async () => {
        if (!selectedGroup) {
            alert("Please select a group first");
            return;
        }
        if (!chargeForm.name || !chargeForm.amount || !chargeForm.startDate) {
            alert("Please fill in all required fields");
            return;
        }
        if (chargeForm.type === "recurring" && !chargeForm.frequency) {
            alert("Please select frequency for recurring charges");
            return;
        }
        try {
            setSaving(true);
            if (editingCharge) {
                await updateGroupCharge(selectedGroup, editingCharge._id, chargeForm);
                alert("Charge updated successfully");
            } else {
                await addGroupCharge(selectedGroup, chargeForm);
                alert("Charge added successfully");
            }
            setShowChargeModal(false);
            await loadGroupCharges(selectedGroup);
        } catch (error) {
            console.error("Error saving charge:", error);
            alert(error?.response?.data?.message || "Failed to save charge");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCharge = async (chargeId) => {
        if (!selectedGroup) return;
        if (!window.confirm("Are you sure you want to delete this charge?")) return;
        try {
            await deleteGroupCharge(selectedGroup, chargeId);
            alert("Charge deleted successfully");
            await loadGroupCharges(selectedGroup);
        } catch (error) {
            console.error("Error deleting charge:", error);
            alert(error?.response?.data?.message || "Failed to delete charge");
        }
    };

    const calculateFinance = async (groupId) => {
        if (!groupId) return;
        try {
            setFinanceData((prev) => ({ ...prev, loading: true }));

            // Load members, loans, recoveries, and FDs in parallel
            const [membersRes, loansRes, recoveriesRes, fdsRes] = await Promise.all([
                getMembersByGroup(groupId).catch(() => ({ data: [] })),
                getLoans(groupId).catch((e) => {
                    console.error("Failed to load loans:", e);
                    return { data: [] };
                }),
                getRecoveries(groupId).catch((e) => {
                    console.error("Failed to load recoveries:", e);
                    return { data: [] };
                }),
                getFDsByGroup(groupId).catch((e) => {
                    console.error("Failed to load FDs:", e);
                    return { data: [] };
                }),
            ]);

            // Handle API response structure: services return { success, message, data: [...] }
            // So we access .data to get the actual array
            const members = Array.isArray(membersRes?.data) ? membersRes.data : [];
            const loans = Array.isArray(loansRes?.data) ? loansRes.data : [];
            const recoveries = Array.isArray(recoveriesRes?.data) ? recoveriesRes.data : [];
            const fds = Array.isArray(fdsRes?.data) ? fdsRes.data : [];

            // Initialize totals
            let totalSavings = 0;
            let totalLoans = 0;
            let totalFD = 0;
            let totalInterest = 0;
            let totalYogdan = 0;
            let totalRecovery = 0;

            // Calculate totals from members - start with opening balances
            const memberMap = new Map();
            members.forEach((member) => {
                const memberId = member._id?.toString() || member.id?.toString();
                memberMap.set(memberId, {
                    openingSaving: parseFloat(member.openingSaving || 0),
                    openingYogdan: parseFloat(member.openingYogdan || 0),
                    currentSaving: parseFloat(member.openingSaving || 0),
                    currentYogdan: parseFloat(member.openingYogdan || 0),
                });

                // Start with opening balances
                totalSavings += parseFloat(member.openingSaving || 0);
                totalYogdan += parseFloat(member.openingYogdan || 0);
            });

            // Aggregate from approved recoveries to get current balances
            recoveries.forEach((recovery) => {
                if (recovery.status === "approved" && recovery.recoveries && Array.isArray(recovery.recoveries)) {
                    // Add to total recovery
                    if (recovery.totals?.totalAmount) {
                        totalRecovery += parseFloat(recovery.totals.totalAmount || 0);
                    }

                    // Process each member recovery
                    recovery.recoveries.forEach((memberRec) => {
                        const memberId = memberRec.memberId?.toString();
                        if (!memberId) return;

                        const amounts = memberRec.amounts || {};

                        // Add saving recoveries
                        const savingAmount = parseFloat(amounts.saving || 0);
                        if (savingAmount > 0) {
                            totalSavings += savingAmount;
                            if (memberMap.has(memberId)) {
                                memberMap.get(memberId).currentSaving += savingAmount;
                            }
                        }

                        // Add yogdan recoveries
                        const yogdanAmount = parseFloat(amounts.yogdan || 0);
                        if (yogdanAmount > 0) {
                            totalYogdan += yogdanAmount;
                            if (memberMap.has(memberId)) {
                                memberMap.get(memberId).currentYogdan += yogdanAmount;
                            }
                        }
                    });
                }
            });

            // Calculate total loans from approved LoanMaster records only
            loans.forEach((loan) => {
                if (loan.status === "approved" && loan.transactionType === "Loan") {
                    totalLoans += parseFloat(loan.amount || 0);
                }
            });

            // Calculate total interest - aggregate unpaid interest from latest recovery for each member
            // We'll use the closingBalance from the latest recovery's demandDetails
            const latestRecoveriesByMember = new Map();
            recoveries.forEach((recovery) => {
                if (recovery.status === "approved" && recovery.recoveries && Array.isArray(recovery.recoveries)) {
                    recovery.recoveries.forEach((memberRec) => {
                        const memberId = memberRec.memberId?.toString();
                        if (!memberId) return;

                        // Get the latest recovery date for each member
                        const recoveryDate = recovery.date ? new Date(recovery.date) : new Date(0);
                        if (!latestRecoveriesByMember.has(memberId) ||
                            recoveryDate > latestRecoveriesByMember.get(memberId).date) {
                            latestRecoveriesByMember.set(memberId, {
                                date: recoveryDate,
                                unpaidInterest: parseFloat(memberRec.demandDetails?.interest?.unpaidDemand || 0)
                            });
                        }
                    });
                }
            });

            // Sum unpaid interest from latest recoveries
            latestRecoveriesByMember.forEach((data) => {
                totalInterest += data.unpaidInterest;
            });

            // If no recoveries exist, fall back to member's overdueInterest
            if (totalInterest === 0) {
                members.forEach((member) => {
                    if (member.loanDetails?.overdueInterest) {
                        totalInterest += parseFloat(member.loanDetails.overdueInterest || 0);
                    }
                });
            }

            // Calculate total FD from FDMaster (all FDs for the group)
            fds.forEach((fd) => {
                const fdAmount = parseFloat(fd.amount || 0);
                if (fdAmount > 0) {
                    totalFD += fdAmount;
                }
            });

            setFinanceData({
                totalSavings,
                totalLoans,
                totalFD,
                totalInterest,
                totalYogdan,
                totalRecovery,
                loading: false,
            });
        } catch (e) {
            console.error("Failed to calculate finance:", e);
            setFinanceData((prev) => ({ ...prev, loading: false }));
        }
    };

    return (
        <div className="w-full">
            <div className="mb-4 md:mb-6">
                <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2 md:gap-3">
                    <Building2 size={24} className="shrink-0" />
                    <span>Group Management Dashboard</span>
                </h1>
                <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Manage all village samooh groups, members, bank details, and finance</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Left Sidebar - Groups List */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 mb-3 md:mb-4">
                        <select
                            value={selectedClusterKey}
                            onChange={(e) => {
                                setSelectedClusterKey(e.target.value);
                                setSelectedGroup(null);
                                setSelectedGroupData(null);
                                setSelectedGroupRaw(null);
                            }}
                            className="w-full mb-3 md:mb-4 px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="">Select Cluster</option>
                            {clusterOptions.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <div className="relative mb-3 md:mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search groups..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 md:pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                        <Link
                            to="/admin/create-group"
                            className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                        >
                            <Plus size={18} />
                            <span>Create New Group</span>
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-3 md:p-4 bg-gray-50 border-b">
                            <h3 className="text-sm md:text-base font-semibold text-gray-800">
                                {groupsLoading ? "Loading groups..." : `All Groups (${filteredGroups.length})`}
                            </h3>
                        </div>
                        <div className="max-h-[400px] md:max-h-[600px] overflow-y-auto">
                            {!selectedClusterKey ? (
                                <div className="p-4 text-center text-gray-500">
                                    Please select a cluster to view groups.
                                </div>
                            ) : (
                                filteredGroups.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => {
                                            setSelectedGroup(group.id);
                                            setSelectedGroupData(group);
                                            setActiveTab("overview");
                                            loadGroupDetail(group.id);
                                            loadGroupMembers(group.id);
                                            loadBanks(group.id);
                                            calculateFinance(group.id);
                                            loadGroupCharges(group.id);
                                        }}
                                        className={`p-3 md:p-4 border-b cursor-pointer transition-colors ${selectedGroup === group.id
                                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                                            : "hover:bg-gray-50"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm md:text-base text-gray-800 truncate">{group.name}</p>
                                                <p className="text-xs md:text-sm text-gray-600">Code: {group.code}</p>
                                                <p className="text-xs md:text-sm text-gray-500 truncate">{group.village}</p>
                                                <div className="flex items-center gap-2 md:gap-4 mt-1 md:mt-2 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Users size={12} />
                                                        {group.noMembers} members
                                                    </span>
                                                </div>
                                            </div>
                                            <Building2
                                                className={`${selectedGroup === group.id ? "text-blue-600" : "text-gray-400"} shrink-0`}
                                                size={18}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side - Group Details */}
                <div className="lg:col-span-2">
                    {selectedGroupData ? (
                        <div className="space-y-6">
                            {/* Group Header */}
                            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 break-words">{selectedGroupData.name}</h2>
                                        <p className="text-sm md:text-base text-gray-600 mt-1 break-words">Code: {selectedGroupData.code} | Village: {selectedGroupData.village}</p>
                                    </div>
                                    <button
                                        onClick={handleEditGroup}
                                        className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shrink-0"
                                    >
                                        <Edit size={16} />
                                        <span className="hidden sm:inline">Edit Group</span>
                                        <span className="sm:hidden">Edit</span>
                                    </button>
                                </div>
                                {detailLoading && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-blue-700 text-xs md:text-sm font-medium">Refreshing group details…</p>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="w-full overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                                    <div className="flex gap-1 md:gap-2 border-b min-w-max md:min-w-0">
                                        {[
                                            { id: "overview", label: "Overview", icon: Eye },
                                            { id: "members", label: "Members", icon: Users },
                                            { id: "bank", label: "Bank Details", icon: Banknote },
                                            { id: "cash", label: "Cash Details", icon: Wallet },
                                            { id: "finance", label: "Finance", icon: DollarSign },
                                            { id: "charges", label: "Charges", icon: CreditCard },
                                            { id: "recovery-details", label: "Recovery Details", icon: Receipt },
                                        ].map((tab) => {
                                            const Icon = tab.icon;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap shrink-0 ${activeTab === tab.id
                                                        ? "text-blue-600 border-b-2 border-blue-600"
                                                        : "text-gray-600 hover:text-gray-800"
                                                        }`}
                                                >
                                                    <Icon size={16} className="shrink-0" />
                                                    <span className="hidden sm:inline">{tab.label}</span>
                                                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Tab Content */}
                            {activeTab === "overview" && selectedGroupRaw && (
                                <div className="space-y-4 md:space-y-6">
                                    {/* Basic Group Information */}
                                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 pb-2 md:pb-3 border-b">Basic Group Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Group Name</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.group_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Group Code</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.group_code || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Village</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.village || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Cluster Name</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.cluster_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Number of Members</p>
                                                <p className="font-semibold text-gray-800">{selectedGroupRaw.no_members || selectedGroupRaw.memberCount || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Formation & Meeting Details */}
                                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 pb-2 md:pb-3 border-b">Formation & Meeting Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedGroupRaw.formation_date && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Formation Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedGroupRaw.formation_date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_1_day && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Date 1 - Day</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_1_day}</p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_2_day && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Date 2 - Day</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_2_day}</p>
                                                </div>
                                            )}
                                            {selectedGroupRaw.meeting_date_2_time && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Meeting Time</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.meeting_date_2_time}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Office Bearers */}
                                    {selectedGroupRaw.mitan_name && (
                                        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 pb-2 md:pb-3 border-b">Office Bearers</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Mitan Name</p>
                                                    <p className="font-semibold text-gray-800">{selectedGroupRaw.mitan_name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Financial Information */}
                                    {(selectedGroupRaw.saving_per_member || selectedGroupRaw.membership_fees || selectedGroupRaw.sahyog_rashi || selectedGroupRaw.shar_capital || selectedGroupRaw.Mship_Group) && (
                                        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 pb-2 md:pb-3 border-b">Financial Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedGroupRaw.saving_per_member && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Saving Per Member</p>
                                                        <p className="font-semibold text-gray-800">₹{selectedGroupRaw.saving_per_member.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.membership_fees && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Membership Fees</p>
                                                        <p className="font-semibold text-gray-800">₹{selectedGroupRaw.membership_fees.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.sahyog_rashi && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Sahyog Rashi</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.sahyog_rashi}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.shar_capital && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Share Capital</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.shar_capital}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.Mship_Group && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Membership Group</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.Mship_Group}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Government Project Information */}
                                    {(selectedGroupRaw.govt_linked || selectedGroupRaw.govt_project_type) && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Government Project Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedGroupRaw.govt_linked && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Linked with Govt Project?</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.govt_linked}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.govt_project_type && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-1">Project Type</p>
                                                        <p className="font-semibold text-gray-800">{selectedGroupRaw.govt_project_type}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Additional Information */}
                                    {(selectedGroupRaw.other || selectedGroupRaw.remark) && (
                                        <div className="bg-white rounded-lg shadow-md p-6">
                                            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Additional Information</h3>
                                            <div className="space-y-4">
                                                {selectedGroupRaw.other && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-2">Other Information</p>
                                                        <p className="font-semibold text-gray-800 whitespace-pre-wrap">{selectedGroupRaw.other}</p>
                                                    </div>
                                                )}
                                                {selectedGroupRaw.remark && (
                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <p className="text-sm text-gray-600 mb-2">Remarks</p>
                                                        <p className="font-semibold text-gray-800 whitespace-pre-wrap">{selectedGroupRaw.remark}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "members" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Group Members</h3>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to={`/admin/member-registration?groupId=${selectedGroupData.id}`}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm w-full sm:w-auto"
                                            >
                                                <Plus size={16} />
                                                <span>Add Member</span>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Date Range Filter and Export Buttons */}
                                    <div className="mb-4 p-3 md:p-4 bg-gray-50 rounded-lg">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-3">
                                            <div>
                                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">From Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRange.fromDate}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">To Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRange.toDate}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <button
                                                onClick={() => handleExportGroupLedger('excel')}
                                                disabled={exportLoading}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm disabled:opacity-50"
                                            >
                                                <Download size={16} />
                                                <span className="hidden sm:inline">{exportLoading ? "Exporting..." : "Export All Members Ledger (Excel)"}</span>
                                                <span className="sm:hidden">{exportLoading ? "Exporting..." : "Export Excel"}</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportGroupLedger('pdf')}
                                                disabled={exportLoading}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs md:text-sm disabled:opacity-50"
                                            >
                                                <FileText size={16} />
                                                <span className="hidden sm:inline">{exportLoading ? "Exporting..." : "Export All Members Ledger (PDF)"}</span>
                                                <span className="sm:hidden">{exportLoading ? "Exporting..." : "Export PDF"}</span>
                                            </button>
                                        </div>
                                    </div>
                                    {membersLoading && (
                                        <p className="text-sm md:text-base text-gray-600 mb-4">Loading members…</p>
                                    )}
                                    <div className="w-full overflow-x-auto rounded-lg border bg-white">
                                        <table className="min-w-[600px] w-full border-collapse text-xs md:text-sm">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Code</th>
                                                    <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Name</th>
                                                    <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Status</th>
                                                    <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupMembers.map((member) => (
                                                    <tr key={member._id} className="hover:bg-gray-50">
                                                        <td className="border p-2 md:p-3 text-gray-800">{member.Member_Id}</td>
                                                        <td className="border p-2 md:p-3 text-gray-800">{member.Member_Nm}</td>
                                                        <td className="border p-2 md:p-3 text-center">
                                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs md:text-sm">
                                                                Active
                                                            </span>
                                                        </td>
                                                        <td className="border p-2 md:p-3">
                                                            <div className="flex flex-wrap items-center gap-1 md:gap-2 justify-center">
                                                                <button
                                                                    onClick={() => handleEditMember(member)}
                                                                    className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs md:text-sm"
                                                                >
                                                                    <Edit size={12} />
                                                                    <span className="hidden sm:inline">Edit</span>
                                                                </button>
                                                                <Link
                                                                    to={`/admin/members/${member._id}`}
                                                                    className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm"
                                                                >
                                                                    <Eye size={12} />
                                                                    <span className="hidden sm:inline">View</span>
                                                                </Link>
                                                                <button
                                                                    onClick={() => handleDeleteMember(member)}
                                                                    className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs md:text-sm"
                                                                >
                                                                    <Trash2 size={12} />
                                                                    <span className="hidden sm:inline">Delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!membersLoading && groupMembers.length === 0 && (
                                                    <tr>
                                                        <td className="border p-3 text-center text-gray-600" colSpan={4}>
                                                            No members found for this group.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === "bank" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Bank Details</h3>
                                        <Link
                                            to={`/admin/bank-details?groupId=${selectedGroupData.id}`}
                                            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm w-full sm:w-auto"
                                        >
                                            <Edit size={16} />
                                            <span>Edit Bank Details</span>
                                        </Link>
                                    </div>
                                    {banksLoading ? (
                                        <p className="text-sm md:text-base text-gray-600">Loading bank accounts…</p>
                                    ) : groupBanks.length > 0 ? (
                                        <div className="w-full overflow-x-auto rounded-lg border bg-white">
                                            <table className="min-w-[800px] w-full border-collapse text-xs md:text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Bank</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Account No</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">IFSC</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Type</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Branch</th>
                                                        <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupBanks.map((b) => (
                                                        <tr key={b._id} className="hover:bg-gray-50">
                                                            <td className="border p-2 md:p-3 text-gray-800">{b.bank_name}</td>
                                                            <td className="border p-2 md:p-3 text-gray-800">{b.account_no}</td>
                                                            <td className="border p-2 md:p-3 text-gray-600">{b.ifsc || "-"}</td>
                                                            <td className="border p-2 md:p-3 text-gray-600">{b.account_type}</td>
                                                            <td className="border p-2 md:p-3 text-gray-600">{b.branch_name || "-"}</td>
                                                            <td className="border p-2 md:p-3">
                                                                <div className="flex flex-wrap items-center gap-1 md:gap-2 justify-center">
                                                                    <button
                                                                        onClick={() => handleEditBank(b)}
                                                                        className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs md:text-sm"
                                                                    >
                                                                        <Edit size={12} />
                                                                        <span className="hidden sm:inline">Edit</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleViewBank(b._id)}
                                                                        className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm"
                                                                    >
                                                                        <Eye size={12} />
                                                                        <span className="hidden sm:inline">View</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 md:py-12">
                                            <Banknote size={40} className="mx-auto mb-4 text-gray-400" />
                                            <p className="text-sm md:text-base text-gray-600 mb-4">No bank accounts added yet</p>
                                            <Link
                                                to={`/admin/bank-details?groupId=${selectedGroupData.id}`}
                                                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                            >
                                                Add Bank Account
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "cash" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="mb-4 md:mb-6">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Cash Details</h3>
                                    </div>

                                    {/* Opening Cash Balance (admin) */}
                                    {selectedGroupRaw && (
                                        <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-xs md:text-sm text-gray-600 mb-2">Opening Cash Balance (admin)</p>
                                            <p className="text-lg font-semibold text-gray-800 mb-3">₹{(selectedGroupRaw?.opening_cash_balance ?? 0).toLocaleString()}</p>
                                            <div className="flex flex-wrap items-end gap-2">
                                                <div className="min-w-[120px]">
                                                    <label className="block text-xs text-gray-600 mb-1">New value</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={openingCashBalanceInput}
                                                        onChange={(e) => setOpeningCashBalanceInput(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveOpeningBalance}
                                                    disabled={savingOpeningBalance}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                                                >
                                                    {savingOpeningBalance ? "Saving..." : "Update Opening Balance"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Current Cash Balance */}
                                    <div className="mb-4 md:mb-6 p-4 md:p-6 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs md:text-sm text-gray-600 mb-2">Current Cash Balance</p>
                                                <p className="text-2xl md:text-3xl font-bold text-green-800">₹{cashBalance.toLocaleString()}</p>
                                            </div>
                                            <Wallet size={32} className="text-green-600 shrink-0" />
                                        </div>
                                    </div>

                                    {/* Cash Transactions Table */}
                                    <div>
                                        <h4 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 pb-2 md:pb-3 border-b">
                                            Cash Transactions ({cashTransactions.length})
                                        </h4>
                                        {cashTransactionsLoading ? (
                                            <div className="text-center py-8 md:py-12">
                                                <p className="text-sm md:text-base text-gray-600">Loading cash transactions...</p>
                                            </div>
                                        ) : cashTransactions.length > 0 ? (
                                            <div className="w-full overflow-x-auto rounded-lg border bg-white">
                                                <table className="min-w-[900px] w-full border-collapse text-xs md:text-sm">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Date</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Direction</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Transaction Type</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Member</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Description</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Amount</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {cashTransactions.map((tx) => (
                                                            <tr key={tx.id || tx._id} className="hover:bg-gray-50">
                                                                <td className="border p-2 md:p-3 text-gray-800">
                                                                    {tx.date
                                                                        ? new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                        : tx.createdAt
                                                                            ? new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                            : "-"}
                                                                </td>
                                                                <td className="border p-2 md:p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.direction === "incoming" || tx.isCredit
                                                                        ? "bg-green-100 text-green-800"
                                                                        : "bg-red-100 text-red-800"
                                                                        }`}>
                                                                        {tx.direction === "incoming" || tx.isCredit ? "Incoming" : "Outgoing"}
                                                                    </span>
                                                                </td>
                                                                <td className="border p-2 md:p-3 text-gray-800 capitalize">{tx.transactionType || "-"}</td>
                                                                <td className="border p-2 md:p-3 text-gray-800">
                                                                    {tx.memberName && tx.memberName !== "-" ? (
                                                                        <>
                                                                            <span className="break-words">{tx.memberName}</span>
                                                                            {tx.memberCode && <span className="text-xs text-gray-500 ml-1">({tx.memberCode})</span>}
                                                                        </>
                                                                    ) : "-"}
                                                                </td>
                                                                <td className="border p-2 md:p-3 text-gray-800 break-words">{tx.description || "-"}</td>
                                                                <td className="border p-2 md:p-3 text-right font-semibold text-gray-800">
                                                                    ₹{(tx.amount || 0).toLocaleString()}
                                                                </td>
                                                                <td className="border p-2 md:p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.status === "verified" || tx.status === "completed"
                                                                        ? "bg-green-100 text-green-800"
                                                                        : tx.status === "pending"
                                                                            ? "bg-yellow-100 text-yellow-800"
                                                                            : "bg-gray-100 text-gray-800"
                                                                        }`}>
                                                                        {tx.status || "N/A"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg">
                                                <Wallet size={40} className="mx-auto mb-4 text-gray-400" />
                                                <p className="text-sm md:text-base text-gray-600">No cash transactions found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === "finance" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Finance Summary</h3>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <button
                                                onClick={() => selectedGroup && calculateFinance(selectedGroup)}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                                                disabled={financeData.loading}
                                            >
                                                {financeData.loading ? "Calculating..." : "Refresh"}
                                            </button>
                                            <Link
                                                to="/admin/demand-recovery"
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                            >
                                                <DollarSign size={16} />
                                                <span>Manage Recovery</span>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Export Section */}
                                    <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gray-50 rounded-lg">
                                        <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-3">Export All Members Ledger</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-3">
                                            <div>
                                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">From Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRange.fromDate}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1">To Date</label>
                                                <input
                                                    type="date"
                                                    value={dateRange.toDate}
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <button
                                                onClick={() => handleExportGroupLedger('excel')}
                                                disabled={exportLoading}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm disabled:opacity-50"
                                            >
                                                <Download size={16} />
                                                <span className="hidden sm:inline">{exportLoading ? "Exporting..." : "Export All Members Ledger (Excel)"}</span>
                                                <span className="sm:hidden">{exportLoading ? "Exporting..." : "Export Excel"}</span>
                                            </button>
                                            <button
                                                onClick={() => handleExportGroupLedger('pdf')}
                                                disabled={exportLoading}
                                                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs md:text-sm disabled:opacity-50"
                                            >
                                                <FileText size={16} />
                                                <span className="hidden sm:inline">{exportLoading ? "Exporting..." : "Export All Members Ledger (PDF)"}</span>
                                                <span className="sm:hidden">{exportLoading ? "Exporting..." : "Export PDF"}</span>
                                            </button>
                                        </div>
                                    </div>
                                    {financeData.loading ? (
                                        <div className="text-center py-8">
                                            <p className="text-sm md:text-base text-gray-600">Calculating finance details...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                                                <div className="p-3 md:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total Savings</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalSavings.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">From members + loan transactions</p>
                                                        </div>
                                                        <TrendingUp className="text-blue-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                                <div className="p-3 md:p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total Loans</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalLoans.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">From members + approved loans</p>
                                                        </div>
                                                        <DollarSign className="text-green-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                                <div className="p-3 md:p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total FD</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalFD.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">From members + FD transactions</p>
                                                        </div>
                                                        <Banknote className="text-purple-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                                <div className="p-3 md:p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total Interest</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalInterest.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">Overdue interest from members</p>
                                                        </div>
                                                        <TrendingUp className="text-orange-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                                <div className="p-3 md:p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total Yogdan</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalYogdan.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">Opening Yogdan from members</p>
                                                        </div>
                                                        <DollarSign className="text-indigo-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                                <div className="p-3 md:p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs md:text-sm text-gray-600">Total Recovery</p>
                                                            <p className="text-xl md:text-2xl font-bold text-gray-800">₹{financeData.totalRecovery.toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500 mt-1 break-words">From approved recovery sessions</p>
                                                        </div>
                                                        <DollarSign className="text-yellow-600 shrink-0 ml-2" size={20} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Net Total and Summary */}
                                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 md:p-6 border-2 border-gray-300">
                                                <div className="flex items-center justify-between mb-3 md:mb-4">
                                                    <h4 className="text-base md:text-lg font-semibold text-gray-800">Net Financial Position</h4>
                                                    <TrendingUp className="text-gray-600 shrink-0" size={24} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                                    <div>
                                                        <p className="text-xs md:text-sm text-gray-600 mb-2">Total Assets</p>
                                                        <p className="text-2xl md:text-3xl font-bold text-green-700">
                                                            ₹{(
                                                                financeData.totalSavings +
                                                                financeData.totalFD +
                                                                financeData.totalRecovery +
                                                                financeData.totalYogdan
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs md:text-sm text-gray-600 mb-2">Total Liabilities</p>
                                                        <p className="text-2xl md:text-3xl font-bold text-red-700">
                                                            ₹{(
                                                                financeData.totalLoans +
                                                                financeData.totalInterest
                                                            ).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-300">
                                                    <p className="text-xs md:text-sm text-gray-600 mb-1">Net Balance</p>
                                                    <p className={`text-3xl md:text-4xl font-bold ${(financeData.totalSavings + financeData.totalFD + financeData.totalRecovery + financeData.totalYogdan) -
                                                        (financeData.totalLoans + financeData.totalInterest) >= 0
                                                        ? "text-green-700"
                                                        : "text-red-700"
                                                        }`}>
                                                        ₹{(
                                                            (financeData.totalSavings + financeData.totalFD + financeData.totalRecovery + financeData.totalYogdan) -
                                                            (financeData.totalLoans + financeData.totalInterest)
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === "charges" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Group Charges</h3>
                                        <button
                                            onClick={handleAddCharge}
                                            className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm w-full sm:w-auto"
                                        >
                                            <Plus size={16} />
                                            <span>Add Charge</span>
                                        </button>
                                    </div>

                                    {chargesLoading ? (
                                        <p className="text-sm md:text-base text-gray-600">Loading charges...</p>
                                    ) : groupCharges.length > 0 ? (
                                        <div className="w-full overflow-x-auto rounded-lg border bg-white">
                                            <table className="min-w-[900px] w-full border-collapse text-xs md:text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Name</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Amount</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Type</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Entry Type</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Frequency</th>
                                                        <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Start Date</th>
                                                        <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Status</th>
                                                        <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupCharges.map((charge) => (
                                                        <tr key={charge._id} className="hover:bg-gray-50">
                                                            <td className="border p-2 md:p-3 text-gray-800">{charge.name}</td>
                                                            <td className="border p-2 md:p-3 text-gray-800">₹{charge.amount?.toLocaleString() || 0}</td>
                                                            <td className="border p-2 md:p-3 text-gray-800">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${charge.type === "one-time" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                                                                    }`}>
                                                                    {charge.type === "one-time" ? "One-Time" : "Recurring"}
                                                                </span>
                                                            </td>
                                                            <td className="border p-2 md:p-3 text-gray-800">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${charge.entryType === "income" ? "bg-green-100 text-green-800" :
                                                                    charge.entryType === "expense" ? "bg-red-100 text-red-800" :
                                                                        charge.entryType === "assets" ? "bg-purple-100 text-purple-800" :
                                                                            charge.entryType === "liability" ? "bg-orange-100 text-orange-800" :
                                                                                "bg-gray-100 text-gray-800"
                                                                    }`}>
                                                                    {charge.entryType ? charge.entryType.charAt(0).toUpperCase() + charge.entryType.slice(1) : "Expense"}
                                                                </span>
                                                            </td>
                                                            <td className="border p-2 md:p-3 text-gray-800">
                                                                {charge.type === "recurring" ? (charge.frequency === "yearly" ? "Yearly" : "Monthly") : "-"}
                                                            </td>
                                                            <td className="border p-2 md:p-3 text-gray-800">
                                                                {charge.startDate ? new Date(charge.startDate).toLocaleDateString("en-GB") : "-"}
                                                            </td>
                                                            <td className="border p-2 md:p-3 text-center">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${charge.isActive !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                                                    }`}>
                                                                    {charge.isActive !== false ? "Active" : "Inactive"}
                                                                </span>
                                                            </td>
                                                            <td className="border p-2 md:p-3">
                                                                <div className="flex flex-wrap items-center gap-1 md:gap-2 justify-center">
                                                                    <button
                                                                        onClick={() => handleEditCharge(charge)}
                                                                        className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs md:text-sm"
                                                                    >
                                                                        <Edit size={12} />
                                                                        <span className="hidden sm:inline">Edit</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteCharge(charge._id)}
                                                                        className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs md:text-sm"
                                                                    >
                                                                        <X size={12} />
                                                                        <span className="hidden sm:inline">Delete</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 md:py-12">
                                            <CreditCard size={40} className="mx-auto mb-4 text-gray-400" />
                                            <p className="text-sm md:text-base text-gray-600 mb-4">No charges added yet</p>
                                            <button
                                                onClick={handleAddCharge}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                            >
                                                Add First Charge
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "recovery-details" && (
                                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">Recovery Details</h3>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                                            {/* Date Range Filter */}
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={dateRange.fromDate}
                                                    onChange={(e) => {
                                                        setDateRange({ ...dateRange, fromDate: e.target.value });
                                                        if (selectedGroup) {
                                                            loadRecoveryDetails(selectedGroup);
                                                        }
                                                    }}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    placeholder="From Date"
                                                />
                                                <span className="text-gray-600 text-sm">to</span>
                                                <input
                                                    type="date"
                                                    value={dateRange.toDate}
                                                    onChange={(e) => {
                                                        setDateRange({ ...dateRange, toDate: e.target.value });
                                                        if (selectedGroup) {
                                                            loadRecoveryDetails(selectedGroup);
                                                        }
                                                    }}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    placeholder="To Date"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {recoveryDetailsLoading ? (
                                        <div className="text-center py-8 md:py-12">
                                            <p className="text-sm md:text-base text-gray-600">Loading recovery details...</p>
                                        </div>
                                    ) : selectedRecovery ? (
                                        <div className="space-y-6">
                                            {/* Back Button */}
                                            <button
                                                onClick={() => setSelectedRecovery(null)}
                                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <X size={18} />
                                                Back to List
                                            </button>

                                            {/* Recovery Session Header */}
                                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <h4 className="text-xl font-bold text-gray-800">
                                                            Recovery Session - {new Date(selectedRecovery.date).toLocaleDateString("en-GB", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric"
                                                            })}
                                                        </h4>
                                                        {selectedRecovery.meetingSequence > 1 && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                Meeting Sequence: {selectedRecovery.meetingSequence}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={() => handleExportRecoveryDetails(selectedRecovery, 'excel')}
                                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                                        >
                                                            <Download size={16} />
                                                            Export Excel
                                                        </button>
                                                        <button
                                                            onClick={() => handleExportRecoveryDetails(selectedRecovery, 'pdf')}
                                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                                                        >
                                                            <FileText size={16} />
                                                            Export PDF
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Totals Summary */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-sm text-gray-600 mb-1">Total Cash</p>
                                                        <p className="text-2xl font-bold text-green-600">
                                                            ₹{Math.round(selectedRecovery.totals?.totalCash || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-sm text-gray-600 mb-1">Total Online</p>
                                                        <p className="text-2xl font-bold text-blue-600">
                                                            ₹{Math.round(selectedRecovery.totals?.totalOnline || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-sm text-gray-600 mb-1">Grand Total</p>
                                                        <p className="text-2xl font-bold text-purple-600">
                                                            ₹{Math.round(selectedRecovery.totals?.totalAmount || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Cash Denominations */}
                                                {selectedRecovery.cashDenominations && selectedRecovery.totals?.totalCash > 0 && (
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-sm font-semibold text-gray-700 mb-2">Cash Denominations</p>
                                                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-sm">
                                                            {selectedRecovery.cashDenominations.note500 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹500:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note500}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note200 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹200:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note200}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note100 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹100:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note100}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note50 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹50:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note50}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note20 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹20:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note20}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note10 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹10:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note10}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note5 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹5:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note5}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note2 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹2:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note2}</span>
                                                                </div>
                                                            )}
                                                            {selectedRecovery.cashDenominations.note1 > 0 && (
                                                                <div>
                                                                    <span className="text-gray-600">₹1:</span> <span className="font-semibold">{selectedRecovery.cashDenominations.note1}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Group Photo */}
                                                {selectedRecovery.groupPhoto && (
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-sm font-semibold text-gray-700 mb-2">Group Photo</p>
                                                        <img
                                                            src={selectedRecovery.groupPhoto.startsWith('data:') ? selectedRecovery.groupPhoto : getImageUrl(selectedRecovery.groupPhoto)}
                                                            alt="Group Photo"
                                                            className="max-w-full h-auto rounded-lg cursor-pointer"
                                                            onClick={() => {
                                                                const imageUrl = selectedRecovery.groupPhoto.startsWith('data:') ? selectedRecovery.groupPhoto : getImageUrl(selectedRecovery.groupPhoto);
                                                                window.open(imageUrl, '_blank');
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Member Recovery Details Table */}
                                            <div className="w-full overflow-x-auto rounded-lg border bg-white">
                                                <table className="min-w-[1400px] w-full border-collapse text-xs md:text-sm">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Member Code</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Member Name</th>
                                                            <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Attendance</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Saving</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Loan</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Interest</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Yogdan</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Mem Fees SHG</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Mem Fees Group</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Mem Fees Samiti</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Penalty</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Other</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">FD</th>
                                                            <th className="border p-2 md:p-3 text-left font-semibold text-gray-700">Charges</th>
                                                            <th className="border p-2 md:p-3 text-center font-semibold text-gray-700">Payment Mode</th>
                                                            <th className="border p-2 md:p-3 text-right font-semibold text-gray-700">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedRecovery.recoveries && selectedRecovery.recoveries.length > 0 ? (
                                                            selectedRecovery.recoveries.map((memberRec, idx) => {
                                                                const amounts = memberRec.amounts || {};
                                                                const saving = Math.round(parseFloat(amounts.saving || 0));
                                                                const loan = Math.round(parseFloat(amounts.loan || 0));
                                                                const interest = Math.round(parseFloat(amounts.interest || 0));
                                                                const yogdan = Math.round(parseFloat(amounts.yogdan || 0));
                                                                const memFeesSHG = Math.round(parseFloat(amounts.memFeesSHG || 0));
                                                                const memFeesGroup = Math.round(parseFloat(amounts.memFeesGroup || 0));
                                                                const memFeesSamiti = Math.round(parseFloat(amounts.memFeesSamiti || 0));
                                                                const penalty = Math.round(parseFloat(amounts.penalty || 0));
                                                                const other = Math.round(parseFloat(amounts.other || 0));
                                                                const fd = Math.round(parseFloat(amounts.fd || 0));
                                                                const charges = amounts.charges || {};
                                                                const chargesTotal = Object.values(charges).reduce((sum, amount) => sum + Math.round(parseFloat(amount || 0)), 0);
                                                                const chargesDetails = Object.keys(charges).length > 0
                                                                    ? Object.entries(charges)
                                                                        .filter(([_, amount]) => parseFloat(amount) > 0)
                                                                        .map(([name, amount]) => `${name}: ₹${Math.round(parseFloat(amount)).toLocaleString()}`)
                                                                        .join(", ")
                                                                    : "—";
                                                                const total = Math.round(parseFloat(memberRec.total || 0));
                                                                const paymentMode = memberRec.paymentMode?.cash && memberRec.paymentMode?.online
                                                                    ? "Cash + Online"
                                                                    : memberRec.paymentMode?.cash
                                                                        ? "Cash"
                                                                        : memberRec.paymentMode?.online
                                                                            ? "Online"
                                                                            : "—";

                                                                return (
                                                                    <tr key={idx} className={`hover:bg-gray-50 ${memberRec.attendance === "absent" ? "bg-red-50" : ""}`}>
                                                                        <td className="border p-2 md:p-3 text-gray-800">{memberRec.memberCode || "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-gray-800 break-words">{memberRec.memberName || "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-center">
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${memberRec.attendance === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                                                {memberRec.attendance === "present" ? "Present" : "Absent"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{saving > 0 ? `₹${saving.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{loan > 0 ? `₹${loan.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{interest > 0 ? `₹${interest.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{yogdan > 0 ? `₹${yogdan.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{memFeesSHG > 0 ? `₹${memFeesSHG.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{memFeesGroup > 0 ? `₹${memFeesGroup.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{memFeesSamiti > 0 ? `₹${memFeesSamiti.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{penalty > 0 ? `₹${penalty.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{other > 0 ? `₹${other.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-right text-gray-800">{fd > 0 ? `₹${fd.toLocaleString()}` : "—"}</td>
                                                                        <td className="border p-2 md:p-3 text-left text-gray-800 break-words" title={chargesDetails}>
                                                                            {chargesTotal > 0 ? `₹${chargesTotal.toLocaleString()}` : "—"}
                                                                            {chargesDetails !== "—" && (
                                                                                <span className="block text-xs text-gray-500 mt-1">{chargesDetails}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="border p-2 md:p-3 text-center">
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${paymentMode === "Cash" ? "bg-green-100 text-green-800" : paymentMode === "Online" ? "bg-blue-100 text-blue-800" : paymentMode === "Cash + Online" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}`}>
                                                                                {paymentMode}
                                                                            </span>
                                                                        </td>
                                                                        <td className="border p-2 md:p-3 text-right font-semibold text-gray-800">{total > 0 ? `₹${total.toLocaleString()}` : "—"}</td>
                                                                    </tr>
                                                                );
                                                            })
                                                        ) : (
                                                            <tr>
                                                                <td colSpan="16" className="border p-6 text-center text-gray-600">
                                                                    No recovery data available
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : recoveryDetails.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="border p-3 text-left font-semibold text-gray-700">Date</th>
                                                        <th className="border p-3 text-center font-semibold text-gray-700">Meeting Sequence</th>
                                                        <th className="border p-3 text-center font-semibold text-gray-700">Member Count</th>
                                                        <th className="border p-3 text-right font-semibold text-gray-700">Total Cash</th>
                                                        <th className="border p-3 text-right font-semibold text-gray-700">Total Online</th>
                                                        <th className="border p-3 text-right font-semibold text-gray-700">Grand Total</th>
                                                        <th className="border p-3 text-center font-semibold text-gray-700">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recoveryDetails.map((recovery) => (
                                                        <tr key={recovery._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRecovery(recovery)}>
                                                            <td className="border p-3 text-gray-800">
                                                                {new Date(recovery.date).toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "2-digit",
                                                                    year: "numeric"
                                                                })}
                                                            </td>
                                                            <td className="border p-3 text-center text-gray-800">{recovery.meetingSequence || 1}</td>
                                                            <td className="border p-3 text-center text-gray-800">{recovery.memberCount || (recovery.recoveries?.length || 0)}</td>
                                                            <td className="border p-3 text-right text-gray-800">₹{Math.round(recovery.totals?.totalCash || 0).toLocaleString()}</td>
                                                            <td className="border p-3 text-right text-gray-800">₹{Math.round(recovery.totals?.totalOnline || 0).toLocaleString()}</td>
                                                            <td className="border p-3 text-right font-semibold text-gray-800">₹{Math.round(recovery.totals?.totalAmount || 0).toLocaleString()}</td>
                                                            <td className="border p-3 text-center">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedRecovery(recovery);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                                                >
                                                                    View Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <Receipt size={48} className="mx-auto mb-4 text-gray-400" />
                                            <p className="text-gray-600">No recovery sessions found</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-md p-12 text-center">
                            <Building2 size={64} className="mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-600 text-lg">Please select a group to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Detail Modal */}
            {showBankModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-gray-800">Bank Details</h2>
                            <button
                                onClick={() => {
                                    setShowBankModal(false);
                                    setSelectedBank(null);
                                    setBankTransactions([]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            {bankDetailLoading ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-600">Loading bank details...</p>
                                </div>
                            ) : selectedBank ? (
                                <>
                                    {/* Bank Information */}
                                    <div className="mb-8">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">Bank Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Bank Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.bank_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Account Number</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.account_no || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">IFSC Code</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.ifsc || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Branch Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.branch_name || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Account Type</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.account_type || "-"}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600 mb-1">Short Name</p>
                                                <p className="font-semibold text-gray-800">{selectedBank.short_name || "-"}</p>
                                            </div>
                                            {selectedBank.ac_open_date && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Open Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.ac_open_date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {(selectedBank.opening_balance !== undefined && selectedBank.opening_balance !== null) ||
                                                (selectedBank.open_bal_curr !== undefined && selectedBank.open_bal_curr !== null) ? (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Opening Balance</p>
                                                    <p className="font-semibold text-gray-800">
                                                        ₹{(selectedBank.opening_balance || selectedBank.open_bal_curr || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                            ) : null}
                                            {selectedBank.cc_limit !== undefined && selectedBank.cc_limit !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">CC Limit</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.cc_limit.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.dp_limit !== undefined && selectedBank.dp_limit !== null && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">DP Limit</p>
                                                    <p className="font-semibold text-gray-800">₹{selectedBank.dp_limit.toLocaleString()}</p>
                                                </div>
                                            )}
                                            {selectedBank.fd_mat_dt && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">FD Maturity Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.fd_mat_dt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedBank.flg_acclosed && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Closed</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.flg_acclosed}</p>
                                                </div>
                                            )}
                                            {selectedBank.acclosed_dt && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Account Closed Date</p>
                                                    <p className="font-semibold text-gray-800">
                                                        {new Date(selectedBank.acclosed_dt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedBank.govt_linked && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Govt Linked</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.govt_linked}</p>
                                                </div>
                                            )}
                                            {selectedBank.govt_project_type && (
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-sm text-gray-600 mb-1">Project Type</p>
                                                    <p className="font-semibold text-gray-800">{selectedBank.govt_project_type}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Current Balance */}
                                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                                                <p className="text-2xl font-bold text-blue-800">₹{(selectedBank.current_balance || 0).toLocaleString()}</p>
                                            </div>
                                            {selectedBank.available_balance !== undefined && (
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-600 mb-1">Available Balance</p>
                                                    <p className="text-xl font-semibold text-gray-800">₹{(selectedBank.available_balance || 0).toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Transactions Table */}
                                    <div className="mb-8">
                                        <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-3 border-b">
                                            Bank Transactions ({bankTransactions.length})
                                        </h3>
                                        {bankTransactions.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-100">
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Date</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Direction</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Transaction Type</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Member</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Description</th>
                                                            <th className="border p-3 text-right font-semibold text-gray-700">Amount</th>
                                                            <th className="border p-3 text-left font-semibold text-gray-700">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {bankTransactions.map((tx) => (
                                                            <tr key={tx.id || tx._id} className="hover:bg-gray-50">
                                                                <td className="border p-3 text-gray-800">
                                                                    {tx.date
                                                                        ? new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                        : tx.createdAt
                                                                            ? new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                                            : "-"}
                                                                </td>
                                                                <td className="border p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.direction === "incoming" || tx.isCredit
                                                                        ? "bg-green-100 text-green-800"
                                                                        : "bg-red-100 text-red-800"
                                                                        }`}>
                                                                        {tx.direction === "incoming" || tx.isCredit ? "Incoming" : "Outgoing"}
                                                                    </span>
                                                                </td>
                                                                <td className="border p-3 text-gray-800 capitalize">{tx.transactionType || "-"}</td>
                                                                <td className="border p-3 text-gray-800">
                                                                    {tx.memberName && tx.memberName !== "-" ? (
                                                                        <>
                                                                            {tx.memberName}
                                                                            {tx.memberCode && <span className="text-xs text-gray-500 ml-1">({tx.memberCode})</span>}
                                                                        </>
                                                                    ) : "-"}
                                                                </td>
                                                                <td className="border p-3 text-gray-800">{tx.description || "-"}</td>
                                                                <td className="border p-3 text-right font-semibold text-gray-800">
                                                                    ₹{(tx.amount || 0).toLocaleString()}
                                                                </td>
                                                                <td className="border p-3">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.status === "verified" || tx.status === "completed"
                                                                        ? "bg-green-100 text-green-800"
                                                                        : tx.status === "pending"
                                                                            ? "bg-yellow-100 text-yellow-800"
                                                                            : "bg-gray-100 text-gray-800"
                                                                        }`}>
                                                                        {tx.status || "N/A"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-gray-50 rounded-lg">
                                                <Banknote size={48} className="mx-auto mb-4 text-gray-400" />
                                                <p className="text-gray-600">No transactions found for this bank account</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-600">Bank details not found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Group Modal */}
            {showEditGroupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Edit Group</h3>
                            <button
                                onClick={() => setShowEditGroupModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Group Name *</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.group_name || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, group_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Group Code *</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.group_code || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, group_code: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Village</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.village || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, village: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cluster Name</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.cluster_name || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, cluster_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">No. of Members</label>
                                    <input
                                        type="number"
                                        value={editGroupForm.no_members || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, no_members: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Formation Date</label>
                                    <input
                                        type="date"
                                        value={editGroupForm.formation_date || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, formation_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mitan Name</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.mitan_name || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, mitan_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Saving Per Member</label>
                                    <input
                                        type="number"
                                        value={editGroupForm.saving_per_member || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, saving_per_member: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Membership Fees</label>
                                    <input
                                        type="number"
                                        value={editGroupForm.membership_fees || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, membership_fees: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Date 1 (Day)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={editGroupForm.meeting_date_1_day || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, meeting_date_1_day: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Date 2 (Day)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={editGroupForm.meeting_date_2_day || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, meeting_date_2_day: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Date 2 (Time)</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.meeting_date_2_time || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, meeting_date_2_time: e.target.value })}
                                        placeholder="e.g., 10:00 AM"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cluster</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.cluster || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, cluster: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Membership Group Amount (Mship_Group)</label>
                                    <input
                                        type="number"
                                        value={editGroupForm.Mship_Group || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, Mship_Group: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Sahyog Rashi</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.sahyog_rashi || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, sahyog_rashi: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Share Capital</label>
                                    <input
                                        type="text"
                                        value={editGroupForm.shar_capital || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, shar_capital: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Saving Rate (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editGroupForm.saving_rate || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, saving_rate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">FD Rate (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editGroupForm.fd_rate || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, fd_rate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Loan Rate (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editGroupForm.loan_rate || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, loan_rate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Opening Cash Balance</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editGroupForm.opening_cash_balance || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, opening_cash_balance: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Govt Linked</label>
                                    <select
                                        value={editGroupForm.govt_linked || "No"}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, govt_linked: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Govt Project Type</label>
                                    <select
                                        value={editGroupForm.govt_project_type || ""}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, govt_project_type: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">None</option>
                                        <option value="NRLM">NRLM</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Login Enabled</label>
                                    <select
                                        value={editGroupForm.loginEnabled ? "true" : "false"}
                                        onChange={(e) => setEditGroupForm({ ...editGroupForm, loginEnabled: e.target.value === "true" })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="true">Enabled</option>
                                        <option value="false">Disabled</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Other</label>
                                <textarea
                                    value={editGroupForm.other || ""}
                                    onChange={(e) => setEditGroupForm({ ...editGroupForm, other: e.target.value })}
                                    rows="2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Remark</label>
                                <textarea
                                    value={editGroupForm.remark || ""}
                                    onChange={(e) => setEditGroupForm({ ...editGroupForm, remark: e.target.value })}
                                    rows="2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleSaveGroup}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                                <button
                                    onClick={() => setShowEditGroupModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Member Modal */}
            {showEditMemberModal && editingMember && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Edit Member</h3>
                            <button
                                onClick={() => {
                                    setShowEditMemberModal(false);
                                    setEditingMember(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Member ID *</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Member_Id || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Member_Id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Member Name *</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Member_Nm || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Member_Nm: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Member Date</label>
                                    <input
                                        type="date"
                                        value={editMemberForm.Member_Dt || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Member_Dt: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Joining</label>
                                    <input
                                        type="date"
                                        value={editMemberForm.Dt_Join || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Dt_Join: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Father/Husband Name</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.F_H_Name || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, F_H_Name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Father/Husband Father Name</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.F_H_FatherName || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, F_H_FatherName: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Voter ID</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Voter_Id || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Voter_Id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Aadhar ID</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Adhar_Id || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Adhar_Id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Ration Card</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Ration_Card || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Ration_Card: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Job Card</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Job_Card || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Job_Card: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">APL/BPL</label>
                                    <select
                                        value={editMemberForm.Apl_Bpl_Etc || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Apl_Bpl_Etc: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select</option>
                                        <option value="APL">APL</option>
                                        <option value="BPL">BPL</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Designation</label>
                                    <select
                                        value={editMemberForm.Desg || "Member"}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Desg: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Member">Member</option>
                                        <option value="President">President</option>
                                        <option value="Secretary">Secretary</option>
                                        <option value="Treasurer">Treasurer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Name</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Bank_Name || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Bank_Name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Branch Name</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Br_Name || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Br_Name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Account</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Bank_Ac || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Bank_Ac: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">IFSC Code</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Ifsc_No || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Ifsc_No: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Age</label>
                                    <input
                                        type="number"
                                        value={editMemberForm.Age || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Age: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Education Qualification</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Edu_Qual || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Edu_Qual: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Annual Income</label>
                                    <input
                                        type="number"
                                        value={editMemberForm.Anual_Income || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Anual_Income: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Profession</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Profession || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Profession: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Caste</label>
                                    <select
                                        value={editMemberForm.Caste || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Caste: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select</option>
                                        <option value="GEN">GEN</option>
                                        <option value="OBC">OBC</option>
                                        <option value="SC">SC</option>
                                        <option value="ST">ST</option>
                                        <option value="MINORITY">MINORITY</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Religion</label>
                                    <select
                                        value={editMemberForm.Religion || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Religion: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select</option>
                                        <option value="Hindu">Hindu</option>
                                        <option value="Muslim">Muslim</option>
                                        <option value="Christian">Christian</option>
                                        <option value="Sikh">Sikh</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cell Phone</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.cell_phone || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, cell_phone: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={editMemberForm.dt_birth || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, dt_birth: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nominee 1</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.nominee_1 || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, nominee_1: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nominee 2</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.nominee_2 || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, nominee_2: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Residential Address 1</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.res_add1 || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, res_add1: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Residential Address 2</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.res_add2 || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, res_add2: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Village</label>
                                    <input
                                        type="text"
                                        value={editMemberForm.Village || ""}
                                        onChange={(e) => setEditMemberForm({ ...editMemberForm, Village: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleSaveMember}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditMemberModal(false);
                                        setEditingMember(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Bank Modal */}
            {showEditBankModal && editingBank && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Edit Bank Account</h3>
                            <button
                                onClick={() => {
                                    setShowEditBankModal(false);
                                    setEditingBank(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bank Name *</label>
                                    <input
                                        type="text"
                                        value={editBankForm.bank_name || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, bank_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Account Number *</label>
                                    <input
                                        type="text"
                                        value={editBankForm.account_no || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, account_no: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">IFSC Code</label>
                                    <input
                                        type="text"
                                        value={editBankForm.ifsc || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, ifsc: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Branch Name</label>
                                    <input
                                        type="text"
                                        value={editBankForm.branch_name || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, branch_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Account Type *</label>
                                    <select
                                        value={editBankForm.account_type || "Saving"}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, account_type: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Saving">Saving</option>
                                        <option value="CC">CC</option>
                                        <option value="FD">FD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Opening Balance</label>
                                    <input
                                        type="number"
                                        value={editBankForm.opening_balance || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, opening_balance: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">CC Limit</label>
                                    <input
                                        type="number"
                                        value={editBankForm.cc_limit || ""}
                                        onChange={(e) => setEditBankForm({ ...editBankForm, cc_limit: e.target.value })}
                                        placeholder="For CC accounts"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleSaveBank}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditBankModal(false);
                                        setEditingBank(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charge Modal */}
            {showChargeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">
                                {editingCharge ? "Edit Charge" : "Add Charge"}
                            </h3>
                            <button
                                onClick={() => setShowChargeModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Charge Name *</label>
                                <input
                                    type="text"
                                    value={chargeForm.name}
                                    onChange={(e) => setChargeForm({ ...chargeForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Registration Fee, Annual Fee"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={chargeForm.amount}
                                    onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Charge Type *</label>
                                <select
                                    value={chargeForm.type}
                                    onChange={(e) => setChargeForm({ ...chargeForm, type: e.target.value, frequency: e.target.value === "one-time" ? undefined : chargeForm.frequency })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="one-time">One-Time</option>
                                    <option value="recurring">Recurring</option>
                                </select>
                            </div>
                            {chargeForm.type === "recurring" && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Frequency *</label>
                                    <select
                                        value={chargeForm.frequency}
                                        onChange={(e) => setChargeForm({ ...chargeForm, frequency: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="yearly">Yearly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date *</label>
                                <input
                                    type="date"
                                    value={chargeForm.startDate}
                                    onChange={(e) => setChargeForm({ ...chargeForm, startDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Entry Type *</label>
                                <select
                                    value={chargeForm.entryType}
                                    onChange={(e) => setChargeForm({ ...chargeForm, entryType: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                    <option value="assets">Assets</option>
                                    <option value="liability">Liability</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={chargeForm.isActive}
                                        onChange={(e) => setChargeForm({ ...chargeForm, isActive: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-semibold text-gray-700">Active</span>
                                </label>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleSaveCharge}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : editingCharge ? "Update Charge" : "Add Charge"}
                                </button>
                                <button
                                    onClick={() => setShowChargeModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

