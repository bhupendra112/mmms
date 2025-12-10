// src/redux/api-urls.ts

//const BaseUrl = "http://localhost:8080/api/admin";
const BaseUrl = "http://72.61.238.122:8080/api/admin"
export const ApiUrl = {
    ADMIN_USER_LOGIN_API: BaseUrl + "/auth/login",
    GET_GROUP_DETAIL_API: BaseUrl + "/group/detail",
    REGISTER_MEMBER_API: BaseUrl + "/member/register-member",
    REGISTER_GROUP_API: BaseUrl + "/group/register-group",
    ADD_BANK_GROUP_API: BaseUrl + "/group/add-bank",
    EXPORT_FULL_MEMBER_API: BaseUrl + "/member/export-pdf",
};
