import messagesRouter from './messagesRoutes';
import friendsRouter from './friendsRoutes';
import callsRouter from './callsRoutes';
import userRoutes from './usersRoutes';
import { Router } from 'express';

const router = Router();
router.use(userRoutes);
router.use(callsRouter);
router.use(friendsRouter);
router.use(messagesRouter);

export default router;
