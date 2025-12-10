import apiResponse from "../../utility/apiResponse.js";
import message from "../../utility/message.js";
import { Member, GroupMaster } from "../../model/index.js";
import PDFDocument from "pdfkit";
import 'pdfkit-table';



/**
 * Register a new member
 */
export const registerMember = async (req, res) => {
    try {
        console.log("📥 Incoming Payload:", req.body);

        const {
            Member_Id,
            Group_Name,
            Member_Dt,
            Dt_Join,
            dt_birth,
            Voter_Id,
            Adhar_Id,
            Job_Card,
            Bank_Ac,
            ...otherFields
        } = req.body;

        // ✅ Required validation
        if (!Member_Id || !Group_Name) {
            return apiResponse.error(res, "Member_Id and Group_Name are required", 400);
        }

        // ✅ Check if Member_Id already exists
        const existingMember = await Member.findOne({ Member_Id });
        if (existingMember) {
            return apiResponse.error(res, "Member_Id already exists", 409);
        }

        // ✅ Optional unique fields check
        const uniqueFields = [
            { field: "Voter_Id", value: Voter_Id },
            { field: "Adhar_Id", value: Adhar_Id },
            { field: "Job_Card", value: Job_Card },
            { field: "Bank_Ac", value: Bank_Ac },
        ];

        for (let item of uniqueFields) {
            if (item.value) {
                const exists = await Member.findOne({ [item.field]: item.value });
                if (exists) {
                    return apiResponse.error(res, `${item.field} already exists`, 409);
                }
            }
        }

        // ✅ Find group
        const group = await GroupMaster.findOne({ group_name: Group_Name }).select("_id");
        if (!group) {
            return apiResponse.error(res, "Group not found. Please create group first.", 404);
        }

        // ✅ Prepare payload
        const memberPayload = {
            Member_Id,
            ...otherFields,
            Member_Dt: Member_Dt ? new Date(Member_Dt) : null,
            Dt_Join: Dt_Join ? new Date(Dt_Join) : null,
            dt_birth: dt_birth ? new Date(dt_birth) : null,
            Voter_Id: Voter_Id || undefined,
            Adhar_Id: Adhar_Id || undefined,
            Job_Card: Job_Card || undefined,
            Bank_Ac: Bank_Ac || undefined,
            group: group._id,
        };

        console.log("📝 Prepared Member Payload:", memberPayload);

        // ✅ Create member
        const member = await Member.create(memberPayload);
        console.log("✅ Member Created Successfully:", member);

        return apiResponse.success(res, message.MEMBER_REGISTERED, member);
    } catch (error) {
        console.error("❌ Member Registration Error:", error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return apiResponse.error(res, `${field} already exists`, 409);
        }

        return apiResponse.error(res, error.message, 500);
    }
};



export const exportMembersPdf = async (req, res) => {
    try {
        const members = await Member.find()
            .populate("group", "group_name")
            .lean();

        if (!members.length) {
            return apiResponse.success(res, "No members found", []);
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=members.pdf"
        );

        const doc = new PDFDocument({
            size: "A4",
            margin: 30,
            bufferPages: true,
        });

        doc.pipe(res);

        const cleanText = (v) =>
            String(v || "").replace(/[\r\n"]/g, " ").trim();

        /* ---------------- TABLE ---------------- */
        const drawTable = (doc, data) => {
            const pageWidth =
                doc.page.width -
                doc.page.margins.left -
                doc.page.margins.right;

            const startX = doc.page.margins.left;
            let y = doc.y;
            const tableStartY = y;

            const rowHeight = 34;
            const textPad = 6;

            const headerBg = "#0B5ED7";
            const altBg = "#F4F6F8";
            const grid = "#D0D0D0";

            const columns = [
                { key: "Member_Nm", label: "Member Name", w: 0.17, wrap: false },
                { key: "F_H_FatherName", label: "Father / Husband", w: 0.17, wrap: false },
                { key: "Village", label: "Village", w: 0.09, wrap: false },
                { key: "Desg", label: "Designation", w: 0.11, wrap: false },
                { key: "Bank_Name", label: "Bank", w: 0.10, wrap: false },
                { key: "Bank_Ac", label: "Account No", w: 0.13, wrap: true },
                { key: "Ifsc_No", label: "IFSC Code", w: 0.12, wrap: true },
                { key: "group_name", label: "Group Name", w: 0.11, wrap: false },
            ];

            let x = startX;
            columns.forEach((c) => {
                c.absW = Math.floor(pageWidth * c.w);
                c.x = x;
                x += c.absW;
            });

            const used = columns.reduce((s, c) => s + c.absW, 0);
            columns[columns.length - 1].absW += pageWidth - used;

            const drawHeader = () => {
                doc.rect(startX, y, pageWidth, rowHeight).fill(headerBg);

                doc.font("Helvetica-Bold")
                    .fontSize(9)
                    .fillColor("#FFFFFF"); // ✅ FORCE WHITE

                columns.forEach((c) => {
                    doc.text(c.label, c.x + textPad, y + 11, {
                        width: c.absW - textPad * 2,
                        lineBreak: false,
                        ellipsis: true,
                    });
                });

                y += rowHeight;
            };

            drawHeader();

            data.forEach((m, index) => {
                const safeBottom =
                    doc.page.height -
                    doc.page.margins.bottom -
                    40;

                if (y + rowHeight > safeBottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    drawHeader();
                }

                if (index % 2 === 0) {
                    doc.rect(startX, y, pageWidth, rowHeight).fill(altBg);
                }

                // ✅ ALWAYS RESET TEXT COLOR AFTER BACKGROUND
                doc.font("Helvetica")
                    .fontSize(9)
                    .fillColor("#000000");

                const row = {
                    Member_Nm: m.Member_Nm,
                    F_H_FatherName: m.F_H_FatherName,
                    Village: m.Village,
                    Desg: m.Desg,
                    Bank_Name: m.Bank_Name,
                    Bank_Ac: m.Bank_Ac,
                    Ifsc_No: m.Ifsc_No,
                    group_name: m.group?.group_name || "",
                };

                columns.forEach((c) => {
                    doc.text(
                        cleanText(row[c.key]),
                        c.x + textPad,
                        y + 8,
                        {
                            width: c.absW - textPad * 2,
                            lineBreak: c.wrap,
                            ellipsis: !c.wrap,
                        }
                    );
                });

                doc.strokeColor(grid)
                    .lineWidth(0.5)
                    .moveTo(startX, y + rowHeight)
                    .lineTo(startX + pageWidth, y + rowHeight)
                    .stroke();

                y += rowHeight;
            });

            doc.strokeColor("#000000")
                .lineWidth(1)
                .rect(startX, tableStartY, pageWidth, y - tableStartY)
                .stroke();

            doc.y = y + 15;
        };

        /* ---------------- TITLE ---------------- */
        doc.font("Helvetica-Bold")
            .fontSize(18)
            .fillColor("#000000") // ✅ FIX (was white)
            .text("Members List Report", { align: "center" });

        doc.moveDown(0.3)
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#444444")
            .text(`Generated on: ${new Date().toLocaleString()}`, {
                align: "center",
            });

        doc.moveDown(1.5);

        drawTable(doc, members);
        doc.end();
    } catch (err) {
        console.error(err);
        return apiResponse.error(res, "PDF generation failed", 500);
    }
};
