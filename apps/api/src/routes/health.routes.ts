import { Router, type Request, type Response } from "express";

const router: Router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
