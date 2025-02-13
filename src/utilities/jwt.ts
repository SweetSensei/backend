import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import logger from './logger';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1d';

interface TokenPayload {
  role: string;
  userId: string;
}

export const generateToken = (payload: TokenPayload): string => {
  try {
    const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (error) {
    logger.error('Error generating JWT token:', { error });
    throw new Error('Failed to generate token');
  }
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    logger.error('Error verifying JWT token:', { error });
    throw new Error('Invalid token');
  }
}; 