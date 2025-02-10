import { Request, Response, NextFunction, RequestHandler } from 'express';
import User from '../models/userModel';
import { createUserSchema } from '../validators/userValidator';
import logger from '../config/logger';

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info('Calling "/api/users" endpoint');
    logger.info('Creating new user', { email: req.body.email });

    const { error, value } = createUserSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn('Validation failed', { errors: error.details });
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((err) => err.message),
      });
    }

    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) {
      logger.warn('User already exists', { email: value.email });
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const user = await User.create(value);
    logger.info('User created successfully', { userId: user._id });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {}
    });
  } catch (error) {
    logger.error('Error creating user:', { error });
    next(error);
  }
};