import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../config/database.js";

const router: Router = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Perform a minimal database query to verify connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      data: {
        status: "ok",
      },
    });
  } catch (error) {
    // Pass error to centralized error handler
    next(error);
  }
});

export default router;
