import express from "express";
import authRoute from "./authRouter.js";
import groupRouter from "./groupRouter.js"
import memberRouter from "./memberRouter.js"

const router = express.Router();

// ✅ Route definitions
const routeArray = [
    { path: "/auth", route: authRoute },
    { path: "/group", route: groupRouter },
    { path: "/member", route: memberRouter },
];

// ✅ Debug & register routes
routeArray.forEach((routeItem) => {
    if (!routeItem || !routeItem.path || !routeItem.route) {
        console.error("❌ Invalid routeItem:", routeItem);
        return;
    }

    console.log(`🔹 Registering route: ${routeItem.path}`);
    router.use(routeItem.path, routeItem.route);
});

// ✅ Debug middleware to catch unhandled routes
router.use((req, res, next) => {
    console.warn(`⚠️  Unhandled route: ${req.method} ${req.originalUrl}`);
    next();
});

export default router;