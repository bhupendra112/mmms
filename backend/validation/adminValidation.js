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
    // Existing member financial details (optional, only if isExistingMember is true)
    isExistingMember: Joi.boolean().optional(),
    openingSaving: Joi.number().optional(),
    fdDetails: Joi.object({
        date: Joi.date().optional(),
        maturityDate: Joi.date().optional(),
        amount: Joi.number().optional(),
        interest: Joi.number().optional(),
    }).optional(),
    loanDetails: Joi.object({
        amount: Joi.number().optional(),
        loanDate: Joi.date().optional(),
        overdueInterest: Joi.number().optional(),
        time_period: Joi.number().min(1).optional(),
        installment_amount: Joi.number().optional(),
    }).optional(),
    openingYogdan: Joi.number().optional(),
    saving_per_member_snapshot: Joi.number().optional(),
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
    cluster: Joi.string().optional(),
    saving_per_member: Joi.number().optional(),
    Mship_Group: Joi.string().optional(),
    membership_fees: Joi.number().optional(),
    mitan_name: Joi.string().optional(),
    meeting_date_1_day: Joi.number().integer().min(1).max(31).optional(),
    meeting_date_2_day: Joi.number().integer().min(1).max(31).optional(),
    meeting_date_2_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    sahyog_rashi: Joi.string().optional(),
    shar_capital: Joi.string().optional(),
    other: Joi.string().optional(),
    remark: Joi.string().optional(),
    govt_linked: Joi.string().valid("Yes", "No").optional(),
    govt_project_type: Joi.string().valid("NRLM", "Other", "").optional(),
    bankmaster: Joi.string().optional(),
    saving_rate: Joi.number().min(0).max(100).optional(),
    fd_rate: Joi.number().min(0).max(100).optional(),
    loan_rate: Joi.number().min(0).max(100).optional()
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

// ======================
// UPDATE GROUP VALIDATION (all fields optional)
// ======================
export const updateGroupSchema = Joi.object({
    group_name: Joi.string().optional(),
    group_code: Joi.string().optional(),
    cluster_name: Joi.string().optional(),
    village: Joi.string().optional(),
    no_members: Joi.number().optional(),
    formation_date: Joi.date().optional(),
    cluster: Joi.string().optional(),
    saving_per_member: Joi.number().optional(),
    Mship_Group: Joi.string().optional(),
    membership_fees: Joi.number().optional(),
    mitan_name: Joi.string().optional(),
    meeting_date_1_day: Joi.number().integer().min(1).max(31).optional(),
    meeting_date_2_day: Joi.number().integer().min(1).max(31).optional(),
    meeting_date_2_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    sahyog_rashi: Joi.string().optional(),
    shar_capital: Joi.string().optional(),
    other: Joi.string().optional(),
    remark: Joi.string().optional(),
    govt_linked: Joi.string().valid("Yes", "No").optional(),
    govt_project_type: Joi.string().valid("NRLM", "Other", "").optional(),
    bankmaster: Joi.string().optional(),
    saving_rate: Joi.number().min(0).max(100).optional(),
    fd_rate: Joi.number().min(0).max(100).optional(),
    loan_rate: Joi.number().min(0).max(100).optional()
}).min(1); // At least one field is required for update

// ======================
// UPDATE BANK VALIDATION (all fields optional)
// ======================
export const updateBankValidationSchema = Joi.object({
    bank_name: Joi.string().optional(),
    account_no: Joi.string().optional(),
    branch_name: Joi.string().optional(),
    ifsc: Joi.string().optional(),
    short_name: Joi.string().optional(),
    ac_open_date: Joi.date().optional(),
    account_type: Joi.string().valid("Saving", "CC", "FD").optional(),
    opening_balance: Joi.number().optional(),
    open_indicator: Joi.string().optional(),
    cc_limit: Joi.number().optional(),
    dp_limit: Joi.number().optional(),
    open_bal_curr: Joi.number().optional(),
    fd_mat_dt: Joi.date().allow(null).optional(),
    open_ind_curr: Joi.string().optional(),
    flg_acclosed: Joi.string().optional(),
    acclosed_dt: Joi.date().allow(null).optional(),
    govt_linked: Joi.string().valid("Yes", "No").optional(),
    govt_project_type: Joi.string().valid("NRLM", "Other", "").optional(),
    group_id: Joi.string().optional(),
}).min(1); // At least one field is required for update

// ======================
// GROUP LOGIN VALIDATION
// ======================
export const groupLoginSchema = Joi.object({
    groupName: Joi.string().required(),
    groupId: Joi.string().optional(),
    groupCode: Joi.string().optional(),
}).or("groupId", "groupCode");