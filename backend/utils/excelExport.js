import ExcelJS from "exceljs";

const INTERNAL_FIELDS = new Set(["_id", "__v"]);

const getSanitizedHeaders = (headers = []) =>
    headers.filter((header) => header && !INTERNAL_FIELDS.has(header));

export const exportToExcel = async (res, data = [], sheetName = "Sheet1", fileName = "export.xlsx", headers = []) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    const derivedHeaders = data.length > 0 ? Object.keys(data[0]) : headers;
    const finalHeaders = getSanitizedHeaders(derivedHeaders);

    if (finalHeaders.length > 0) {
        worksheet.columns = finalHeaders.map((header) => ({
            header,
            key: header,
            width: Math.max(String(header).length + 5, 18),
        }));
    }

    if (data.length > 0) {
        const sanitizedRows = data.map((row) =>
            finalHeaders.reduce((acc, key) => {
                acc[key] = row?.[key] ?? "";
                return acc;
            }, {})
        );
        worksheet.addRows(sanitizedRows);
    }

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
};
