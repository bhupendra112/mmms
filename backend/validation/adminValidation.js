import Joi from "joi";

// ======================
// ADMIN REGISTER
// ======================
export const adminRegisterValidationSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

// ======================
// ADMIN LOGIN
// ======================
export const loginValidationSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// ======================
// MEMBER REGISTER
// ======================
export const registerMemberSchema = Joi.object({
    Member_Id: Joi.string().trim().required(),
    Member_Nm: Joi.string().trim().required(),

    Member_Dt: Joi.date().required(),
    Dt_Join: Joi.date().required(),

    F_H_Name: Joi.string().trim().required(),
    F_H_FatherName: Joi.string().trim().required(),

    Voter_Id: Joi.string().allow("", null),
    Adhar_Id: Joi.string().allow("", null),
    Ration_Card: Joi.string().allow("", null),
    Job_Card: Joi.string().allow("", null),

    Apl_Bpl_Etc: Joi.string().allow("", null),
    Desg: Joi.string().allow("", null),

    Bank_Name: Joi.string().allow("", null),
    Br_Name: Joi.string().allow("", null),
    Bank_Ac: Joi.string().allow("", null),
    Ifsc_No: Joi.string().allow("", null),

    Age: Joi.number().allow(null),
    Anual_Income: Joi.number().allow(null),

    Edu_Qual: Joi.string().allow("", null),
    Profession: Joi.string().allow("", null),

    Caste: Joi.string().allow("", null),
    Religion: Joi.string().allow("", null),

    cell_phone: Joi.string().allow("", null),
    dt_birth: Joi.date().allow(null),

    nominee_1: Joi.string().allow("", null),
    nominee_2: Joi.string().allow("", null),

    res_add1: Joi.string().allow("", null),
    res_add2: Joi.string().allow("", null),
    Village: Joi.string().allow("", null),

    Group_Name: Joi.string().required(),
});

// ======================
// GROUP REGISTER VALIDATION
// ======================
export const registerGroupSchema = Joi.object({
    group_name: Joi.string().required(),
    group_code: Joi.string().required(),
    cluster_name: Joi.string().optional(),
    village: Joi.string().optional(),
    no_members: Joi.number().optional(),
    formation_date: Joi.date().optional(),
    president_name: Joi.string().optional(),
    secretary_name: Joi.string().optional(),
    treasurer_name: Joi.string().optional(),
    cluster: Joi.string().optional(),
    saving_per_member: Joi.number().optional(),
    Mship_Group: Joi.string().optional(),
    membership_fees: Joi.number().optional(),
    mitan_name: Joi.string().optional(),
    meeting_date_1: Joi.date().optional(),
    meeting_date_2: Joi.date().optional(),
    sahyog_rashi: Joi.string().optional(),
    shar_capital: Joi.string().optional(),
    other: Joi.string().optional(),
    remark: Joi.string().optional(),
    govt_linked: Joi.string().valid("Yes", "No").optional(),
    govt_project_type: Joi.string().valid("NRLM", "Other", "").optional(),
    bankmaster: Joi.string().optional()
});


export const addBankValidationSchema = Joi.object({
    bank_name: Joi.string().required(),
    account_no: Joi.string().required(),
    branch_name: Joi.string().optional(),
    ifsc: Joi.string().optional(),
    short_name: Joi.string().optional(),

    ac_open_date: Joi.date().optional(),

    account_type: Joi.string().valid("Saving", "CC", "FD").required(),

    opening_balance: Joi.number().optional(),
    open_indicator: Joi.string().optional(),

    cc_limit: Joi.number().optional(),
    dp_limit: Joi.number().optional(),

    open_bal_curr: Joi.number().optional(),
    fd_mat_dt: Joi.date().allow(null).optional(),

    open_ind_curr: Joi.string().optional(),

    flg_acclosed: Joi.string().optional(),
    acclosed_dt: Joi.date().allow(null).optional(), // FIXED

    govt_linked: Joi.string().valid("Yes", "No").optional(),
    govt_project_type: Joi.string().valid("NRLM", "Other", "").optional(),

    group_id: Joi.string().optional(),
});