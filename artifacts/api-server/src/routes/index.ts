import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shiftsRouter from "./shifts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shiftsRouter);

export default router;
