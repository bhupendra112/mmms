import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "SECRET_KEY";

// Middleware that accepts both admin and group tokens
export default function authAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token)
        return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Set req.user with id, email, and place
        req.user = { 
            id: decoded.id, 
            email: decoded.email,
            place: decoded.place 
        };
        
        // Set req.admin with full decoded token (works for both admin and group)
        req.admin = decoded;
        
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
}
