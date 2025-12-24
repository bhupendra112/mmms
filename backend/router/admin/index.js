import express from "express";
import authRoute from "./authRouter.js";
import groupRouter from "./groupRouter.js"
import memberRouter from "./memberRouter.js"
import loanRouter from "./loanRouter.js"
import recoveryRouter from "./recoveryRouter.js"
import groupAuthRouter from "./groupAuthRouter.js"
import dataManagementRouter from "./dataManagementRouter.js"
import fdRouter from "./fdRouter.js"
import paymentRouter from "./paymentRouter.js"

const router = express.Router();

// ✅ Route definitions
const routeArray = [
    { path: "/auth", route: authRoute },
    { path: "/group", route: groupRouter },
    { path: "/member", route: memberRouter },
    { path: "/loan", route: loanRouter },
    { path: "/recovery", route: recoveryRouter },
    { path: "/group-auth", route: groupAuthRouter },
    { path: "/data-management", route: dataManagementRouter },
    { path: "/fd", route: fdRouter },
    { path: "/payment", route: paymentRouter },
];

// ✅ Register routes
routeArray.forEach((routeItem) => {
    if (!routeItem || !routeItem.path || !routeItem.route) {
        return;
    }
    router.use(routeItem.path, routeItem.route);
});

export default router;