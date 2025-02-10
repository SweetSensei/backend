import { Request, Response, NextFunction, RequestHandler } from 'express';
import User from '../models/userModel';
import { createUserSchema, loginSchema } from '../validators/userValidator';
import logger from '../config/logger';
import bcrypt from 'bcrypt';

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(value.password, salt);

    const user = await User.create({
      ...value,
      password: hashedPassword,
    });
    
    logger.info('User created successfully', { userId: user._id });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
      }
    });
  } catch (error) {
    logger.error('Error creating user:', { error });
    next(error);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info('Calling "/api/users/login" endpoint');

    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn('Login validation failed', { errors: error.details });
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((err) => err.message),
      });
    }

    const user = await User.findOne({ email: value.email });
    if (!user) {
      logger.warn('user not found', { email: value.email });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password with hashed password
    const isPasswordValid = await bcrypt.compare(value.password, user.password);
    if (!isPasswordValid) {
      logger.warn('invalid password', { email: value.email });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    logger.info('User logged in successfully', { userId: user._id });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Error during login:', { error });
    next(error);
  }
};