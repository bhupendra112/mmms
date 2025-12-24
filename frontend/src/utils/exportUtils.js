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

// Export member ledger to Excel
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

// Export member ledger to PDF
export const exportMemberLedgerToPDF = (ledgerData, filename = 'Member_Ledger') => {
    ledgerData.forEach((memberData, index) => {
        const { memberInfo, ledger, summary } = memberData;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        let yPos = 15;

        // Title
        doc.setFontSize(18);
        doc.text('Member Finance Ledger', 14, yPos);
        yPos += 10;

        // Member Information
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

        // Opening Balances
        doc.setFontSize(12);
        doc.text('Opening Balances', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);

        const openingBalances = [
            `Savings: ${formatCurrency(summary.openingSavings)}`,
            `Loan: ${formatCurrency(summary.openingLoan)}`,
            `FD: ${formatCurrency(summary.openingFD)}`,
            `Interest: ${formatCurrency(summary.openingInterest)}`,
            `Yogdan: ${formatCurrency(summary.openingYogdan)}`
        ];

        openingBalances.forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });

        yPos += 5;

        // Transaction Table
        const headers = [
            'Date',
            'Receipt',
            'Sav Dep',
            'Sav W/D',
            'Sav Bal',
            'Loan Paid',
            'Loan Bal',
            'FD Dep',
            'FD Bal',
            'Int Paid',
            'Yogdan',
            'Other'
        ];

        const rows = ledger.map(entry => [
            formatDate(entry.date),
            (entry.receipt || '').substring(0, 15),
            `${formatCurrency(entry.savingsDeposit || 0)}`,
            `${formatCurrency(entry.savingsWithdraw || 0)}`,
            `${formatCurrency(entry.savingsBalance || 0)}`,
            `${formatCurrency(entry.loanPaid || 0)}`,
            `${formatCurrency(entry.loanBalance || 0)}`,
            `${formatCurrency(entry.fdDeposit || 0)}`,
            `${formatCurrency(entry.fdBalance || 0)}`,
            `${formatCurrency(entry.interestPaid || 0)}`,
            `${formatCurrency(entry.yogdan || 0)}`,
            `${formatCurrency(entry.other || 0)}`
        ]);

        // Add table using autoTable function
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: yPos,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [66, 139, 202] },
            margin: { left: 14, right: 14 },
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Summary Section
        if (yPos > 180) {
            doc.addPage();
            yPos = 15;
        }

        doc.setFontSize(12);
        doc.text('Summary', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);

        const summaryText = [
            `Total Savings Deposit: ${formatCurrency(summary.totalSavingsDeposit)}`,
            `Total Savings Withdraw: ${formatCurrency(summary.totalSavingsWithdraw)}`,
            `Total Loan Paid: ${formatCurrency(summary.totalLoanPaid)}`,
            `Total FD Deposit: ${formatCurrency(summary.totalFdDeposit)}`,
            `Total Interest Paid: ${formatCurrency(summary.totalInterestPaid)}`,
            `Total Yogdan: ${formatCurrency(summary.totalYogdan)}`,
            `Total Other: ${formatCurrency(summary.totalOther)}`
        ];

        summaryText.forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });

        yPos += 5;

        // Closing Balances
        doc.setFontSize(12);
        doc.text('Closing Balances', 14, yPos);
        yPos += 7;
        doc.setFontSize(10);

        const closingBalances = [
            `Savings: ${formatCurrency(summary.closingSavings)}`,
            `Loan: ${formatCurrency(summary.closingLoan)}`,
            `FD: ${formatCurrency(summary.closingFD)}`,
            `Interest: ${formatCurrency(summary.closingInterest)}`,
            `Yogdan: ${formatCurrency(summary.closingYogdan)}`
        ];

        closingBalances.forEach(text => {
            doc.text(text, 14, yPos);
            yPos += 6;
        });

        // Footer
        doc.setFontSize(8);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);

        const memberFilename = `${filename}_${memberInfo.code || `Member_${index + 1}`}_${new Date().toISOString().split('T')[0]}`;
        doc.save(`${memberFilename}.pdf`);
    });
};

