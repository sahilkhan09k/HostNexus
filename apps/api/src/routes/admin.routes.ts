import { Router, type IRouter } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authenticateAdmin } from "../middleware/admin.middleware.js";

const router: IRouter = Router();

// Public admin login
router.post("/login", AdminController.login);

// All routes below require a valid admin token
router.use(authenticateAdmin);

router.get("/summary", AdminController.getSummary);
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/approve", AdminController.approveUser);
router.patch("/users/:id/reject", AdminController.rejectUser);

export default router;
