import express, { RequestHandler } from 'express';
import { createUser } from '../controllers/userController';

const router = express.Router();

router.post('/', createUser as RequestHandler);

export default router; 