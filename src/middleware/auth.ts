import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyToken } from '../utilities/jwt';
import { formatResponse } from '../utilities/response';
import logger from '../utilities/logger';
import { DB_TABLE_NAMES } from 'src/utilities/constants';
import { DynamoDB } from 'aws-sdk';

export interface AuthorizedEvent extends APIGatewayProxyEvent {
  user?: {
    role: string;
    userId?: string;
  };
}

const dynamoDb = new DynamoDB.DocumentClient();

export const authenticate = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyEvent | APIGatewayProxyResult> => {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader) {
      logger.error('No authorization header');
      return formatResponse(401, {
        message: 'No authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      logger.error('No token provided');
      return formatResponse(401, {
        message: 'No token provided'
      });
    }

    
    const decoded = verifyToken(token);

    // Extend the event object with user data
    (event as AuthorizedEvent).user = {
        role: decoded.role,
        userId: decoded.userId 
    };
    
    const user = await dynamoDb.get({
      TableName: DB_TABLE_NAMES.USERS,
      Key: {
        id: decoded.userId
      }
    }).promise();

    if (!user.Item) {
      logger.error('User not found');
      return formatResponse(401, {
        message: 'User not found'
      });
    }

    return event as AuthorizedEvent;

  } catch (error) {
    logger.error('Authentication error:', error);
    return formatResponse(401, {
      message: 'Invalid token'
    });
  }
}; 