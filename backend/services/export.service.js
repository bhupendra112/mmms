import { BankMaster, GroupMaster, Member } from "../model/index.js";

const INTERNAL_FIELDS = new Set(["_id", "__v"]);

const getModelHeaders = (Model) =>
    Object.keys(Model?.schema?.paths || {}).filter((key) => !INTERNAL_FIELDS.has(key));

const getSanitizedData = async (Model) => {
    const rows = await Model.find().lean();
    const headers = getModelHeaders(Model);

    if (!rows.length) {
        return { rows: [], headers };
    }

    const sanitizedRows = rows.map((row) =>
        Object.keys(row).reduce((acc, key) => {
            if (!INTERNAL_FIELDS.has(key)) {
                acc[key] = row[key];
            }
            return acc;
        }, {})
    );

    return { rows: sanitizedRows, headers };
};

export const getBankMasterData = async () => getSanitizedData(BankMaster);

export const getGroupMasterData = async () => getSanitizedData(GroupMaster);

export const getShgMemberMasterData = async () => getSanitizedData(Member);
