import { setAuth, logout } from "../slice/authSlice";
import { adminLoginApi } from "../../Api/authApi";

export const loginAction = (email, password) => async (dispatch) => {
    try {
        const res = await adminLoginApi({ email, password });
        const token = res.data?.data?.token;
        const adminName = res.data?.data?.admin?.name;

        if (!token) throw new Error("Token missing in login response");

        dispatch(setAuth({ token, adminName }));
    } catch (error) {
        console.error("LOGIN ACTION ERROR:", error?.response?.data || error.message);
        throw error;
    }
};

export const logoutAction = () => (dispatch) => {
    dispatch(logout());
};
