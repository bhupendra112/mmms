import jwt from "jsonwebtoken";

export default function authAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        // Check header exists
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization header missing",
            });
        }

        // Expected format: "Bearer token"
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing",
            });
        }

        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "JWT secret not configured",
            });
        }

        // ✅ CORRECT verification
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach decoded payload to request
        req.admin = decoded;

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
}
