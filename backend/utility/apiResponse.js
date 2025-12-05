class apiResponse {
    static success(res, message, data = {}) {
        return res.status(200).json({ success: true, message, data });
    }

    static error(res, message, status = 400) {
        return res.status(status).json({ success: false, message });
    }
}

export default apiResponse;