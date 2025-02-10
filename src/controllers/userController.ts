import { Request, Response, NextFunction } from 'express';
import User from '../models/userModel';

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};