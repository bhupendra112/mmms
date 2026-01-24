import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { GroupMaster } from "../model/index.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "SECRET_KEY";

// Middleware that accepts both admin and group tokens
export default async function authAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token)
        return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Set req.admin with full decoded token (works for both admin and group)
        req.admin = decoded;

        // Handle group tokens differently from admin tokens
        if (decoded.type === "group") {
            // For group tokens, fetch place from group document
            try {
                const group = await GroupMaster.findById(decoded.id).select('place').lean();
                if (group && group.place) {
                    req.user = {
                        id: decoded.id,
                        type: "group",
                        groupName: decoded.groupName,
                        groupCode: decoded.groupCode,
                        place: group.place
                    };
                } else {
                    req.user = {
                        id: decoded.id,
                        type: "group",
                        groupName: decoded.groupName,
                        groupCode: decoded.groupCode,
                        place: null
                    };
                }
            } catch (error) {
                console.error("[authAdmin] Error fetching group place:", error);
                req.user = {
                    id: decoded.id,
                    type: "group",
                    groupName: decoded.groupName,
                    groupCode: decoded.groupCode,
                    place: null
                };
            }
        } else {
            // For admin tokens, set req.user with id, email, and place
            req.user = {
                id: decoded.id,
                email: decoded.email,
                place: decoded.place
            };
        }

        next();
    } catch (err) {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
}
