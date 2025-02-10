import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import userRoutes from './routes/userRoutes';
import { notFoundHandler } from './middleware/notFoundHandler';

dotenv.config();

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app; 