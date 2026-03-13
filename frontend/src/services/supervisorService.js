import httpSupervisor from "../api/httpSupervisor";

export const getSupervisors = async () => {
    const res = await httpSupervisor.get("/");
    return res.data;
};

export const createSupervisor = async (body) => {
    const res = await httpSupervisor.post("/create", body);
    return res.data;
};

export const updateSupervisor = async (id, body) => {
    const res = await httpSupervisor.put(`/${id}`, body);
    return res.data;
};

export const disableSupervisor = async (id) => {
    const res = await httpSupervisor.delete(`/${id}`);
    return res.data;
};
