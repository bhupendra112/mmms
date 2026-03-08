import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Export to Excel
export const exportToExcel = (data, filename = 'export') => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

// Export to PDF
export const exportToPDF = (title, headers, rows, filename = 'export') => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);

    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    // Add table using autoTable function
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`${filename}.pdf`);
};

// Export recovery data to Excel
export const exportRecoveryToExcel = (recoveries, groupName) => {
    const data = recoveries.map((recovery) => ({
        'Member Code': recovery.memberCode,
        'Member Name': recovery.memberName,
        'Attendance': recovery.attendance,
        'Recovery By Other': recovery.recoveryByOther ? 'Yes' : 'No',
        'Other Member': recovery.otherMemberId || '-',
        'Savings': recovery.amounts?.saving || 0,
        'Loan': recovery.amounts?.loan || 0,
        'FD': recovery.amounts?.fd || 0,
        'Interest': recovery.amounts?.interest || 0,
        'Other': recovery.amounts?.other || 0,
        'Total Amount':
            (recovery.amounts?.saving || 0) +
            (recovery.amounts?.loan || 0) +
            (recovery.amounts?.fd || 0) +
            (recovery.amounts?.interest || 0) +
            (recovery.amounts?.other || 0),
        'Payment Mode':
            recovery.paymentMode?.cash && recovery.paymentMode?.online
                ? 'Cash & Online'
                : recovery.paymentMode?.cash
                    ? 'Cash'
                    : recovery.paymentMode?.online
                        ? 'Online'
                        : '-',
        'Online Reference': recovery.onlineRef || '-',
        'Date': recovery.date,
    }));

    exportToExcel(data, `${groupName}_Recovery_${new Date().toISOString().split('T')[0]}`);
};

// Export recovery data to PDF
export const exportRecoveryToPDF = (recoveries, groupName, totals) => {
    const headers = [
        'Member Code',
        'Member Name',
        'Attendance',
        'Savings',
        'Loan',
        'FD',
        'Interest',
        'Other',
        'Total',
        'Payment Mode',
    ];

    const rows = recoveries.map((recovery) => {
        const total =
            (recovery.amounts?.saving || 0) +
            (recovery.amounts?.loan || 0) +
            (recovery.amounts?.fd || 0) +
            (recovery.amounts?.interest || 0) +
            (recovery.amounts?.other || 0);

        const paymentMode =
            recovery.paymentMode?.cash && recovery.paymentMode?.online
                ? 'Cash & Online'
                : recovery.paymentMode?.cash
                    ? 'Cash'
                    : recovery.paymentMode?.online
                        ? 'Online'
                        : '-';

        return [
            recovery.memberCode,
            recovery.memberName,
            recovery.attendance,
            `${recovery.amounts?.saving || 0}`,
            `${recovery.amounts?.loan || 0}`,
            `${recovery.amounts?.fd || 0}`,
            `${recovery.amounts?.interest || 0}`,
            `${recovery.amounts?.other || 0}`,
            `${total}`,
            paymentMode,
        ];
    });

    // Add summary row
    rows.push([
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${totals.totalAmount}`,
        `Cash: ${totals.totalCash} | Online: ${totals.totalOnline}`,
    ]);

    exportToPDF(
        `${groupName} - Recovery Report`,
        headers,
        rows,
        `${groupName}_Recovery_${new Date().toISOString().split('T')[0]}`
    );
};

// Export loan data to Excel
export const exportLoanToExcel = (loans, groupName) => {
    const data = loans.map((loan) => ({
        'Member Code': loan.memberCode,
        'Member Name': loan.memberName,
        'Has Assets': loan.hasAssets ? 'Yes' : 'No',
        'Transaction Type': loan.transactionType,
        'Payment Mode': loan.paymentMode,
        'Purpose': loan.purpose,
        'Amount': loan.amount,
        'Date': loan.date,
    }));

    exportToExcel(data, `${groupName}_Loans_${new Date().toISOString().split('T')[0]}`);
};

// Export loan data to PDF
export const exportLoanToPDF = (loans, groupName) => {
    const headers = [
        'Member Code',
        'Member Name',
        'Has Assets',
        'Transaction Type',
        'Payment Mode',
        'Purpose',
        'Amount',
        'Date',
    ];

    const rows = loans.map((loan) => [
        loan.memberCode,
        loan.memberName,
        loan.hasAssets ? 'Yes' : 'No',
        loan.transactionType,
        loan.paymentMode,
        loan.purpose,
        `${loan.amount}`,
        loan.date,
    ]);

    const totalAmount = loans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    rows.push(['TOTAL', '', '', '', '', '', `${totalAmount}`, '']);

    exportToPDF(
        `${groupName} - Loan Report`,
        headers,
        rows,
        `${groupName}_Loans_${new Date().toISOString().split('T')[0]}`
    );
};

// Format date helper
const formatDate = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(date);
    }
};

// Format currency helper
const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
};

/**
 * Export member summary to Excel: single sheet, one row per member, no transaction details.
 * Uses same ledgerData from exportMemberLedger API (memberInfo + summary per member).
 */
export const exportMemberSummaryToExcel = (ledgerData, filename = 'Member_Summary') => {
    if (!ledgerData || ledgerData.length === 0) {
        return;
    }
    const headers = [
        'Member Code',
        'Member Name',
        'Father/Husband Name',
        'Village',
        'Group Name',
        'Group Code',
        'Joining Date',
        'Existing Member',
        'Opening Savings',
        'Closing Savings',
        'Opening Loan',
        'Closing Loan',
        'Opening FD',
        'Closing FD',
        'Opening Interest',
        'Closing Interest',
        'Opening Yogdan',
        'Closing Yogdan Due',
        'Total Savings Deposit',
        'Total Savings Withdraw',
        'Total Loan Paid',
        'Total Loan Recovered',
        'Total FD Deposit',
        'Total FD Withdraw',
        'Total Interest Paid',
        'Total Yogdan Due',
        'Total Yogdan Paid',
        'Total Other',
    ];
    const rows = ledgerData.map(({ memberInfo, summary }) => [
        memberInfo.code || '',
        memberInfo.name || '',
        memberInfo.fatherName || '',
        memberInfo.village || '',
        memberInfo.groupName || '',
        memberInfo.groupCode || '',
        formatDate(memberInfo.joiningDate),
        memberInfo.isExistingMember ? 'Yes' : 'No',
        formatCurrency(summary?.openingSavings),
        formatCurrency(summary?.closingSavings),
        formatCurrency(summary?.openingLoan),
        formatCurrency(summary?.closingLoan),
        formatCurrency(summary?.openingFD),
        formatCurrency(summary?.closingFD),
        formatCurrency(summary?.openingInterest),
        formatCurrency(summary?.closingInterest),
        formatCurrency(summary?.openingYogdan),
        formatCurrency(summary?.closingYogdanDue),
        formatCurrency(summary?.totalSavingsDeposit),
        formatCurrency(summary?.totalSavingsWithdraw),
        formatCurrency(summary?.totalLoanPaid),
        formatCurrency(summary?.totalLoanRecovered),
        formatCurrency(summary?.totalFdDeposit),
        formatCurrency(summary?.totalFdWithdraw),
        formatCurrency(summary?.totalInterestPaid),
        formatCurrency(summary?.totalYogdanDue),
        formatCurrency(summary?.totalYogdanPaid),
        formatCurrency(summary?.totalOther),
    ]);
    const allRows = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    const colWidths = headers.map((_, i) => ({ wch: Math.min(18, Math.max(12, (headers[i] || '').length + 2)) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    const finalFilename = `${filename}_${new Date().toISOString().split('T')[0]}`;
    XLSX.writeFile(wb, `${finalFilename}.xlsx`);
};

// Export member ledger to Excel (multiple sheets, one per member, with full transaction table - kept for backward compatibility)
export const exportMemberLedgerToExcel = (ledgerData, filename = 'Member_Ledger') => {
    const wb = XLSX.utils.book_new();

    ledgerData.forEach((memberData, index) => {
        const { memberInfo, ledger, summary } = memberData;
        const sheetName = memberInfo.code || `Member_${index + 1}`;

        // Member Information Section
        const memberInfoRows = [
            ['Member Finance Ledger'],
            [],
            ['Member Information'],
            ['Member Code', memberInfo.code || ''],
            ['Member Name', memberInfo.name || ''],
            ['Father/Husband Name', memberInfo.fatherName || ''],
            ['Village', memberInfo.village || ''],
            ['Group Name', memberInfo.groupName || ''],
            ['Group Code', memberInfo.groupCode || ''],
            ['Joining Date', formatDate(memberInfo.joiningDate)],
            ['Existing Member', memberInfo.isExistingMember ? 'Yes' : 'No'],
            [],
            ['Opening Balances'],
            ['Opening Savings', `₹${formatCurrency(summary.openingSavings)}`],
            ['Opening Loan', `₹${formatCurrency(summary.openingLoan)}`],
            ['Opening FD', `₹${formatCurrency(summary.openingFD)}`],
            ['Opening Interest', `₹${formatCurrency(summary.openingInterest)}`],
            ['Opening Yogdan', `₹${formatCurrency(summary.openingYogdan)}`],
            [],
        ];

        // Transaction Table Headers
        const headers = [
            'Date',
            'Receipt/Description',
            'Savings Deposit',
            'Savings Withdraw',
            'Savings Balance',
            'Loan Paid',
            'Loan Recovered',
            'Loan Balance',
            'FD Deposit',
            'FD Withdraw',
            'FD Balance',
            'Interest Due',
            'Interest Paid',
            'Yogdan',
            'Other'
        ];

        // Transaction Rows
        const transactionRows = ledger.map(entry => [
            formatDate(entry.date),
            entry.receipt || '',
            `₹${formatCurrency(entry.savingsDeposit || 0)}`,
            `₹${formatCurrency(entry.savingsWithdraw || 0)}`,
            `₹${formatCurrency(entry.savingsBalance || 0)}`,
            `₹${formatCurrency(entry.loanPaid || 0)}`,
            `₹${formatCurrency(entry.loanRecovered || 0)}`,
            `₹${formatCurrency(entry.loanBalance || 0)}`,
            `₹${formatCurrency(entry.fdDeposit || 0)}`,
            `₹${formatCurrency(entry.fdWithdraw || 0)}`,
            `₹${formatCurrency(entry.fdBalance || 0)}`,
            `₹${formatCurrency(entry.interestDue || 0)}`,
            `₹${formatCurrency(entry.interestPaid || 0)}`,
            `₹${formatCurrency(entry.yogdan || 0)}`,
            `₹${formatCurrency(entry.other || 0)}`
        ]);

        // Summary Section
        const summaryRows = [
            [],
            ['Summary'],
            ['Total Savings Deposit', `₹${formatCurrency(summary.totalSavingsDeposit)}`],
            ['Total Savings Withdraw', `₹${formatCurrency(summary.totalSavingsWithdraw)}`],
            ['Total Loan Paid', `₹${formatCurrency(summary.totalLoanPaid)}`],
            ['Total Loan Recovered', `₹${formatCurrency(summary.totalLoanRecovered)}`],
            ['Total FD Deposit', `₹${formatCurrency(summary.totalFdDeposit)}`],
            ['Total FD Withdraw', `₹${formatCurrency(summary.totalFdWithdraw)}`],
            ['Total Interest Paid', `₹${formatCurrency(summary.totalInterestPaid)}`],
            ['Total Yogdan', `₹${formatCurrency(summary.totalYogdan)}`],
            ['Total Other', `₹${formatCurrency(summary.totalOther)}`],
            [],
            ['Closing Balances'],
            ['Closing Savings', `₹${formatCurrency(summary.closingSavings)}`],
            ['Closing Loan', `₹${formatCurrency(summary.closingLoan)}`],
            ['Closing FD', `₹${formatCurrency(summary.closingFD)}`],
            ['Closing Interest', `₹${formatCurrency(summary.closingInterest)}`],
            ['Closing Yogdan', `₹${formatCurrency(summary.closingYogdan)}`],
        ];

        // Combine all rows
        const allRows = [
            ...memberInfoRows,
            ['Transaction Details'],
            headers,
            ...transactionRows,
            ...summaryRows
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(allRows);

        // Set column widths
        const colWidths = [
            { wch: 12 }, // Date
            { wch: 25 }, // Receipt
            { wch: 15 }, // Savings Deposit
            { wch: 15 }, // Savings Withdraw
            { wch: 15 }, // Savings Balance
            { wch: 12 }, // Loan Paid
            { wch: 15 }, // Loan Recovered
            { wch: 15 }, // Loan Balance
            { wch: 12 }, // FD Deposit
            { wch: 12 }, // FD Withdraw
            { wch: 12 }, // FD Balance
            { wch: 12 }, // Interest Due
            { wch: 12 }, // Interest Paid
            { wch: 12 }, // Yogdan
            { wch: 12 }  // Other
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel sheet name limit
    });

    const finalFilename = `${filename}_${new Date().toISOString().split('T')[0]}`;
    XLSX.writeFile(wb, `${finalFilename}.xlsx`);
};

/**
 * Export member summary to PDF: single document, one row per member, same format as Excel summary.
 * No transaction details.
 */
export const exportMemberSummaryToPDF = (ledgerData, filename = 'Member_Summary') => {
    if (!ledgerData || ledgerData.length === 0) return;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const headers = [
        'Code',
        'Name',
        'F/H Name',
        'Village',
        'Group',
        'Grp Code',
        'Join Date',
        'Existing',
        'Op Sav',
        'Cl Sav',
        'Op Loan',
        'Cl Loan',
        'Op FD',
        'Cl FD',
        'Op Int',
        'Cl Int',
        'Op Yog',
        'Cl Yog',
        'Tot Sav Dep',
        'Tot Sav W/D',
        'Tot Loan Paid',
        'Tot Loan Rec',
        'Tot FD Dep',
        'Tot FD W/D',
        'Tot Int Paid',
        'Tot Yog Due',
        'Tot Yog Paid',
        'Other',
    ];
    const rows = ledgerData.map(({ memberInfo, summary }) => [
        String(memberInfo.code || '').substring(0, 12),
        String(memberInfo.name || '').substring(0, 15),
        String(memberInfo.fatherName || '').substring(0, 12),
        String(memberInfo.village || '').substring(0, 10),
        String(memberInfo.groupName || '').substring(0, 12),
        String(memberInfo.groupCode || '').substring(0, 8),
        formatDate(memberInfo.joiningDate) || '',
        memberInfo.isExistingMember ? 'Y' : 'N',
        formatCurrency(summary?.openingSavings),
        formatCurrency(summary?.closingSavings),
        formatCurrency(summary?.openingLoan),
        formatCurrency(summary?.closingLoan),
        formatCurrency(summary?.openingFD),
        formatCurrency(summary?.closingFD),
        formatCurrency(summary?.openingInterest),
        formatCurrency(summary?.closingInterest),
        formatCurrency(summary?.openingYogdan),
        formatCurrency(summary?.closingYogdanDue),
        formatCurrency(summary?.totalSavingsDeposit),
        formatCurrency(summary?.totalSavingsWithdraw),
        formatCurrency(summary?.totalLoanPaid),
        formatCurrency(summary?.totalLoanRecovered),
        formatCurrency(summary?.totalFdDeposit),
        formatCurrency(summary?.totalFdWithdraw),
        formatCurrency(summary?.totalInterestPaid),
        formatCurrency(summary?.totalYogdanDue),
        formatCurrency(summary?.totalYogdanPaid),
        formatCurrency(summary?.totalOther),
    ]);
    doc.setFontSize(14);
    doc.text('Member Summary', 14, 12);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | ${ledgerData.length} member(s)`, 14, 18);
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 22,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [66, 139, 202] },
        margin: { left: 14, right: 14 },
        showHead: 'everyPage',
    });
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
    const finalFilename = `${filename}_${new Date().toISOString().split('T')[0]}`;
    doc.save(`${finalFilename}.pdf`);
};

// Export member ledger to PDF (legacy: one PDF per member with full transaction table - kept for backward compatibility)
export const exportMemberLedgerToPDF = (ledgerData, filename = 'Member_Ledger') => {
    ledgerData.forEach((memberData, index) => {
        const { memberInfo, ledger, summary } = memberData;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        let yPos = 15;

        doc.setFontSize(18);
        doc.text('Member Finance Ledger', 14, yPos);
        yPos += 10;
        doc.setFontSize(12);
        doc.text('Member Information', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        const memberInfoText = [
            `Member Code: ${memberInfo.code || ''}`,
            `Member Name: ${memberInfo.name || ''}`,
            `Father/Husband Name: ${memberInfo.fatherName || ''}`,
            `Village: ${memberInfo.village || ''}`,
            `Group: ${memberInfo.groupName || ''} (${memberInfo.groupCode || ''})`,
            `Joining Date: ${formatDate(memberInfo.joiningDate)}`,
            `Existing Member: ${memberInfo.isExistingMember ? 'Yes' : 'No'}`
        ];
        memberInfoText.forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Opening Balances', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        ['Savings', 'Loan', 'FD', 'Interest', 'Yogdan'].forEach((label, i) => {
            const val = [summary.openingSavings, summary.openingLoan, summary.openingFD, summary.openingInterest, summary.openingYogdan][i];
            doc.text(`${label}: ${formatCurrency(val)}`, 14, yPos);
            yPos += 6;
        });
        yPos += 5;
        const headers = ['Date', 'Receipt', 'Sav Dep', 'Sav W/D', 'Sav Bal', 'Loan Paid', 'Loan Bal', 'FD Dep', 'FD Bal', 'Int Paid', 'Yogdan', 'Other'];
        const rows = ledger.map(entry => [
            formatDate(entry.date),
            (entry.receipt || '').substring(0, 15),
            formatCurrency(entry.savingsDeposit || 0),
            formatCurrency(entry.savingsWithdraw || 0),
            formatCurrency(entry.savingsBalance || 0),
            formatCurrency(entry.loanPaid || 0),
            formatCurrency(entry.loanBalance || 0),
            formatCurrency(entry.fdDeposit || 0),
            formatCurrency(entry.fdBalance || 0),
            formatCurrency(entry.interestPaid || 0),
            formatCurrency(entry.yogdan || 0),
            formatCurrency(entry.other || 0)
        ]);
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: yPos,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [66, 139, 202] },
            margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 10;
        if (yPos > 180) {
            doc.addPage();
            yPos = 15;
        }
        doc.setFontSize(12);
        doc.text('Summary', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        [
            `Total Savings Deposit: ${formatCurrency(summary.totalSavingsDeposit)}`,
            `Total Savings Withdraw: ${formatCurrency(summary.totalSavingsWithdraw)}`,
            `Total Loan Paid: ${formatCurrency(summary.totalLoanPaid)}`,
            `Total FD Deposit: ${formatCurrency(summary.totalFdDeposit)}`,
            `Total Interest Paid: ${formatCurrency(summary.totalInterestPaid)}`,
            `Total Yogdan: ${formatCurrency(summary.totalYogdan)}`,
            `Total Other: ${formatCurrency(summary.totalOther)}`
        ].forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });
        yPos += 5;
        doc.setFontSize(12);
        doc.text('Closing Balances', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        [
            `Savings: ${formatCurrency(summary.closingSavings)}`,
            `Loan: ${formatCurrency(summary.closingLoan)}`,
            `FD: ${formatCurrency(summary.closingFD)}`,
            `Interest: ${formatCurrency(summary.closingInterest)}`,
            `Yogdan: ${formatCurrency(summary.closingYogdan)}`
        ].forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });
        doc.setFontSize(8);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
        const memberFilename = `${filename}_${memberInfo.code || `Member_${index + 1}`}_${new Date().toISOString().split('T')[0]}`;
        doc.save(`${memberFilename}.pdf`);
    });
};

// Export detailed recovery session to Excel
export const exportRecoveryDetailsToExcel = (recoveries, groupName, recoverySession, filename) => {
    const data = recoveries.map((recovery) => {
        const amounts = recovery.amounts || {};
        const charges = amounts.charges || {};
        const chargesDetails = Object.keys(charges).length > 0
            ? Object.entries(charges)
                .filter(([_, amount]) => parseFloat(amount) > 0)
                .map(([name, amount]) => `${name}: ₹${Math.round(parseFloat(amount)).toLocaleString()}`)
                .join(", ")
            : "";

        return {
            'Member Code': recovery.memberCode || '',
            'Member Name': recovery.memberName || '',
            'Attendance': recovery.attendance || '',
            'Saving': Math.round(parseFloat(amounts.saving || 0)),
            'Loan': Math.round(parseFloat(amounts.loan || 0)),
            'Interest': Math.round(parseFloat(amounts.interest || 0)),
            'Yogdan': Math.round(parseFloat(amounts.yogdan || 0)),
            'Mem Fees SHG': Math.round(parseFloat(amounts.memFeesSHG || 0)),
            'Mem Fees Group': Math.round(parseFloat(amounts.memFeesGroup || 0)),
            'Mem Fees Samiti': Math.round(parseFloat(amounts.memFeesSamiti || 0)),
            'Penalty': Math.round(parseFloat(amounts.penalty || 0)),
            'Other': Math.round(parseFloat(amounts.other || 0)),
            'FD': Math.round(parseFloat(amounts.fd || 0)),
            'Charges': chargesDetails || '',
            'Charges Total': Object.values(charges).reduce((sum, amount) => sum + Math.round(parseFloat(amount || 0)), 0),
            'Payment Mode': recovery.paymentMode?.cash && recovery.paymentMode?.online
                ? 'Cash + Online'
                : recovery.paymentMode?.cash
                    ? 'Cash'
                    : recovery.paymentMode?.online
                        ? 'Online'
                        : '',
            'Online Reference': recovery.onlineRef || '',
            'Total Amount': Math.round(parseFloat(recovery.total || 0))
        };
    });

    // Add summary row
    const totals = recoverySession.totals || {};
    data.push({
        'Member Code': 'TOTAL',
        'Member Name': '',
        'Attendance': '',
        'Saving': '',
        'Loan': '',
        'Interest': '',
        'Yogdan': '',
        'Mem Fees SHG': '',
        'Mem Fees Group': '',
        'Mem Fees Samiti': '',
        'Penalty': '',
        'Other': '',
        'FD': '',
        'Charges': '',
        'Charges Total': '',
        'Payment Mode': `Cash: ₹${Math.round(totals.totalCash || 0).toLocaleString()} | Online: ₹${Math.round(totals.totalOnline || 0).toLocaleString()}`,
        'Online Reference': '',
        'Total Amount': Math.round(totals.totalAmount || 0)
    });

    exportToExcel(data, filename);
};

// Export detailed recovery session to PDF
export const exportRecoveryDetailsToPDF = (recoveries, groupName, recoverySession, filename) => {
    const headers = [
        'Member Code',
        'Member Name',
        'Attendance',
        'Saving',
        'Loan',
        'Interest',
        'Yogdan',
        'Mem Fees SHG',
        'Mem Fees Group',
        'Charges',
        'Total',
        'Payment Mode'
    ];

    const rows = recoveries.map((recovery) => {
        const amounts = recovery.amounts || {};
        const charges = amounts.charges || {};
        const chargesTotal = Object.values(charges).reduce((sum, amount) => sum + Math.round(parseFloat(amount || 0)), 0);
        const total = Math.round(parseFloat(recovery.total || 0));
        const paymentMode = recovery.paymentMode?.cash && recovery.paymentMode?.online
            ? 'Cash + Online'
            : recovery.paymentMode?.cash
                ? 'Cash'
                : recovery.paymentMode?.online
                    ? 'Online'
                    : '—';

        return [
            recovery.memberCode || '',
            recovery.memberName || '',
            recovery.attendance || '',
            `${Math.round(parseFloat(amounts.saving || 0))}`,
            `${Math.round(parseFloat(amounts.loan || 0))}`,
            `${Math.round(parseFloat(amounts.interest || 0))}`,
            `${Math.round(parseFloat(amounts.yogdan || 0))}`,
            `${Math.round(parseFloat(amounts.memFeesSHG || 0))}`,
            `${Math.round(parseFloat(amounts.memFeesGroup || 0))}`,
            `${chargesTotal}`,
            `${total}`,
            paymentMode
        ];
    });

    // Add summary row
    const totals = recoverySession.totals || {};
    rows.push([
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${Math.round(totals.totalAmount || 0)}`,
        `Cash: ₹${Math.round(totals.totalCash || 0).toLocaleString()} | Online: ₹${Math.round(totals.totalOnline || 0).toLocaleString()}`
    ]);

    const recoveryDate = new Date(recoverySession.date).toLocaleDateString("en-GB");
    exportToPDF(
        `${groupName} - Recovery Details (${recoveryDate})`,
        headers,
        rows,
        filename
    );
};

