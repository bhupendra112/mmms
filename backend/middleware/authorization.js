import jwt from "jsonwebtoken";

export default function authAdmin(req, res, next) {
    const token = req.headers.authorization ?.split(" ")[1];

    if (!token)
        return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, "SECRET_KEY");
        req.admin = decoded;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
}