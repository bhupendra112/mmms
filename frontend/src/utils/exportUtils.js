import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

    // Add table
    doc.autoTable({
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
            `₹${recovery.amounts?.saving || 0}`,
            `₹${recovery.amounts?.loan || 0}`,
            `₹${recovery.amounts?.fd || 0}`,
            `₹${recovery.amounts?.interest || 0}`,
            `₹${recovery.amounts?.other || 0}`,
            `₹${total}`,
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
        `₹${totals.totalAmount}`,
        `Cash: ₹${totals.totalCash} | Online: ₹${totals.totalOnline}`,
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
        `₹${loan.amount}`,
        loan.date,
    ]);

    const totalAmount = loans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    rows.push(['TOTAL', '', '', '', '', '', `₹${totalAmount}`, '']);

    exportToPDF(
        `${groupName} - Loan Report`,
        headers,
        rows,
        `${groupName}_Loans_${new Date().toISOString().split('T')[0]}`
    );
};

