import PDFDocument from 'pdfkit';

/**
 * Generate a professional recovery report PDF with member-wise sections
 * @param {Object} recoveryData - Recovery data grouped by member
 * @param {Object} groupInfo - Group information
 * @param {Object} totals - Total amounts (cash, online, total)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateRecoveryPDF = (recoveryData, groupInfo, totals) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject);

        // Helper function to format currency (without rupee symbol)
        const formatCurrency = (amount) => {
            const num = parseFloat(amount || 0);
            return `${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        // Helper function to add a horizontal line
        const addLine = (y) => {
            doc.moveTo(50, y).lineTo(545, y).stroke();
            return y + 10;
        };

        // Helper function to check if we need a new page
        const checkPageBreak = (currentY, neededSpace = 50) => {
            if (currentY + neededSpace > 750) {
                doc.addPage();
                return 50;
            }
            return currentY;
        };

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('Recovery Report', 50, 50, { align: 'center' });
        
        // Group Information
        doc.fontSize(14).font('Helvetica-Bold').text(groupInfo.name || 'Group Name', 50, 90);
        doc.fontSize(10).font('Helvetica');
        if (groupInfo.code) {
            doc.text(`Group Code: ${groupInfo.code}`, 50, 110);
        }
        if (groupInfo.village) {
            doc.text(`Village: ${groupInfo.village}`, 50, 125);
        }
        
        // Date
        const reportDate = recoveryData.date ? new Date(recoveryData.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
        doc.text(`Date: ${reportDate}`, 400, 110);
        const now = new Date();
        doc.text(`Generated: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 400, 125);

        let y = 160;

        // Summary Section
        doc.fontSize(12).font('Helvetica-Bold').text('Summary', 50, y);
        y += 20;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Cash: ${formatCurrency(totals.totalCash || 0)}`, 50, y);
        doc.text(`Total Online: ${formatCurrency(totals.totalOnline || 0)}`, 250, y);
        doc.text(`Grand Total: ${formatCurrency(totals.totalAmount || 0)}`, 400, y);
        y += 30;

        // Add a divider line
        y = addLine(y);
        y += 10;

        // Member-wise sections
        const recoveries = recoveryData.recoveries || [];
        
        recoveries.forEach((recovery, index) => {
            // Check if we need a new page before starting a new member section
            y = checkPageBreak(y, 100);

            // Member Header
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(`${index + 1}. ${recovery.memberName || 'N/A'}`, 50, y);
            y += 15;
            
            doc.fontSize(10).font('Helvetica');
            doc.text(`Member Code: ${recovery.memberCode || 'N/A'}`, 50, y);
            doc.text(`Attendance: ${recovery.attendance === 'present' ? 'Present' : 'Absent'}`, 250, y);
            
            if (recovery.recoveryByOther) {
                doc.text(`Recovery By: ${recovery.otherMemberId || 'Other Member'}`, 400, y);
            }
            y += 20;

            // Amounts Table Header
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Category', 50, y);
            doc.text('Amount', 350, y);
            y += 15;
            
            doc.fontSize(9).font('Helvetica');
            const amounts = recovery.amounts || {};
            
            // List all amounts
            const amountFields = [
                { label: 'Saving', value: amounts.saving },
                { label: 'Loan', value: amounts.loan },
                { label: 'Interest', value: amounts.interest },
                { label: 'Yogdan', value: amounts.yogdan },
                { label: 'FD', value: amounts.fd },
                { label: 'Member Fees SHG', value: amounts.memFeesSHG },
                { label: 'Member Fees Samiti', value: amounts.memFeesSamiti },
                { label: 'Member Fees Group', value: amounts.memFeesGroup },
                { label: 'Penalty', value: amounts.penalty },
                { label: 'Other', value: amounts.other },
            ];

            // Add charges if any
            if (amounts.charges && Object.keys(amounts.charges).length > 0) {
                Object.entries(amounts.charges).forEach(([chargeName, chargeAmount]) => {
                    if (parseFloat(chargeAmount || 0) > 0) {
                        amountFields.push({ label: `Charge: ${chargeName}`, value: chargeAmount });
                    }
                });
            }

            amountFields.forEach(field => {
                if (field.value && parseFloat(field.value) > 0) {
                    y = checkPageBreak(y, 15);
                    doc.text(field.label, 60, y);
                    doc.text(formatCurrency(field.value), 350, y);
                    y += 12;
                }
            });

            // Total for this member
            const memberTotal = recovery.total || 
                (parseFloat(amounts.saving || 0) +
                 parseFloat(amounts.loan || 0) +
                 parseFloat(amounts.interest || 0) +
                 parseFloat(amounts.yogdan || 0) +
                 parseFloat(amounts.fd || 0) +
                 parseFloat(amounts.memFeesSHG || 0) +
                 parseFloat(amounts.memFeesSamiti || 0) +
                 parseFloat(amounts.memFeesGroup || 0) +
                 parseFloat(amounts.penalty || 0) +
                 parseFloat(amounts.other || 0) +
                 (amounts.charges ? Object.values(amounts.charges).reduce((sum, val) => sum + (parseFloat(val) || 0), 0) : 0));

            y = checkPageBreak(y, 15);
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Total', 50, y);
            doc.text(formatCurrency(memberTotal), 350, y);
            y += 15;

            // Payment Mode
            const paymentMode = recovery.paymentMode || {};
            let paymentModeText = '';
            if (paymentMode.cash && paymentMode.online) {
                paymentModeText = 'Cash & Online';
            } else if (paymentMode.cash) {
                paymentModeText = 'Cash';
            } else if (paymentMode.online) {
                paymentModeText = 'Online';
            }
            
            if (paymentModeText) {
                y = checkPageBreak(y, 15);
                doc.fontSize(9).font('Helvetica');
                doc.text(`Payment Mode: ${paymentModeText}`, 50, y);
                if (paymentMode.online && recovery.onlineRef) {
                    doc.text(`Reference: ${recovery.onlineRef}`, 300, y);
                }
                y += 15;
            }

            // Add divider line after each member (except last)
            if (index < recoveries.length - 1) {
                y += 5;
                y = addLine(y);
                y += 10;
            }
        });

        // Footer on each page
        let pageCount = 0;
        doc.on('pageAdded', () => {
            pageCount++;
        });

        // Add footer after all pages are added
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica').text(
                `Page ${i + 1} of ${range.count}`,
                50,
                doc.page.height - 30,
                { align: 'center', width: 495 }
            );
        }

        doc.end();
    });
};
