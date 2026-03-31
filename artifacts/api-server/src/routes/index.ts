import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(analyticsRouter);

export default router;
