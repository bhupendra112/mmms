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
    group_id: Joi.string().optional(),
    group_code: Joi.string().optional(),
    Member_Id: Joi.string().required(),
    Member_Nm: Joi.string().required(),
    Member_Dt: Joi.date().required(),
    Dt_Join: Joi.date().required(),
    F_H_Name: Joi.string().required(),
    F_H_FatherName: Joi.string().required(),
    Voter_Id: Joi.string().optional(),
    Adhar_Id: Joi.string().optional(),
    Ration_Card: Joi.string().optional(),
    Job_Card: Joi.string().optional(),
    Apl_Bpl_Etc: Joi.string().optional(),
    Desg: Joi.string().optional(),
    Bank_Name: Joi.string().optional(),
    Br_Name: Joi.string().optional(),
    Bank_Ac: Joi.string().optional(),
    Ifsc_No: Joi.string().optional(),
    Age: Joi.number().optional(),
    Edu_Qual: Joi.string().optional(),
    Anual_Income: Joi.number().optional(),
    Profession: Joi.string().optional(),
    Caste: Joi.string().optional(),
    Religion: Joi.string().optional(),
    cell_phone: Joi.string().optional(),
    dt_birth: Joi.date().optional(),
    nominee_1: Joi.string().optional(),
    nominee_2: Joi.string().optional(),
    res_add1: Joi.string().optional(),
    res_add2: Joi.string().optional(),
    Village: Joi.string().optional(),
    Group_Name: Joi.string().optional(),
}).or("group_id", "group_code", "Group_Name");

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