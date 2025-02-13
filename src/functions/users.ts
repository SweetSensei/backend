import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { signupSchema, loginSchema } from 'src/utilities/validations/userValidations';
import logger from 'src/utilities/logger';
import { DB_TABLE_NAMES } from 'src/utilities/constants';
import { generateToken } from 'src/utilities/jwt';
import { formatResponse } from 'src/utilities/response';
import { AuthorizedEvent } from 'src/middleware/auth';
import { authenticate } from 'src/middleware/auth';
import { addAddressSchema } from 'src/utilities/validations/userValidations';

const dynamoDb = new DynamoDB.DocumentClient();

interface Address {
  id: string;  // Generated unique ID for each address
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
  label: 'home' | 'work' | 'other';
}

interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  addresses: Address[];
  createdAt: string;
  updatedAt: string;
}

interface SignupRequest {
  email: string;
  password: string;
}

export const signup = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try{
    logger.info('POST "/users" ');
    
    const body = JSON.parse(event.body as string) as SignupRequest;
    
    const { error, value } = signupSchema.validate(body, { abortEarly: false });
    
    if (error) {
      logger.error('Validation error', { errors: error.details.map(detail => detail.message) });
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const validatedBody = value;

    const existingUser = await dynamoDb.query({
      TableName: DB_TABLE_NAMES.USERS as string,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': validatedBody.email,
      },
    }).promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      logger.error('User with this email already exists');
      return formatResponse(409, {
        message: 'User with this email already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedBody.password, salt);

    const timestamp = new Date().toISOString();
    const user = {
      id: uuidv4(),
      email: validatedBody.email,
      password: hashedPassword,
      role: 'customer',
      addresses: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await dynamoDb.put({
      TableName: DB_TABLE_NAMES.USERS as string,
      Item: user,
      ConditionExpression: 'attribute_not_exists(id)',
    }).promise();

    logger.info('User created successfully');

    return formatResponse(201, {
      message: 'User created successfully',
    });

  }catch(error){

    if (error instanceof Error) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.info('User already exists');
        return formatResponse(409, {
          message: 'User already exists',
        });
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Internal server error', { error: errorMessage });
    return formatResponse(500, {
      message: 'Internal server error',
      error: errorMessage,
    });

  }
};

export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('POST "/users/login"');
    
    const body = JSON.parse(event.body as string) as SignupRequest;
    
    const { error, value } = loginSchema.validate(body, { abortEarly: false });
    
    if (error) {
      logger.error('Validation error', { errors: error.details.map(detail => detail.message) });
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const user = await dynamoDb.query({
      TableName: DB_TABLE_NAMES.USERS as string,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': value.email,
      },
    }).promise();

    if (!user.Items || user.Items.length === 0) {
      logger.error('Invalid credentials');
      return formatResponse(400, {
        message: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(value.password, user.Items[0].password);
    if (!isValidPassword) {
      logger.error('Invalid credentials');
      return formatResponse(400, {
        message: 'Invalid credentials'
      });
    }

    logger.info('User logged in successfully');
    return formatResponse(200, {
      message: 'Login successful',
      token: generateToken({  role: user.Items[0].role, userId: user.Items[0].id }),
      role: user.Items[0].role
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Internal server error', { error: errorMessage });
    return formatResponse(500, {
      message: 'Internal server error',
      error: errorMessage,
    });
  }
};

export const addAddress = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('POST "/users/addresses"');

    const authResult = await authenticate(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authenticatedEvent = authResult as AuthorizedEvent;
    const userId = authenticatedEvent.user?.userId;

    const body = JSON.parse(event.body as string)
    
    const { error, value } = addAddressSchema.validate(body, { abortEarly: false });
    
    if (error) {
      logger.error('Validation error', { errors: error.details.map(detail => detail.message) });
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { name, street, city, state, country, zipCode, phone } = value;

    await dynamoDb.update({
      TableName: DB_TABLE_NAMES.USERS,
      Key: {
        id: userId  
      },
      UpdateExpression: 'SET addresses = list_append(if_not_exists(addresses, :empty_list), :newAddress), updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':newAddress': [{
          name,
          street,
          city,
          state,
          country,
          zipCode, 
          phone
        }],
        ':empty_list': [],
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }).promise();

    return formatResponse(200, {
      message: 'Address added successfully',
    });

  } catch (error) {
    logger.error('Error adding address:', error);
    return formatResponse(500, {
      message: 'Could not add address',
    });
  }
};

export const getAddress = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('GET "/users/address"');

    const authResult = await authenticate(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authenticatedEvent = authResult as AuthorizedEvent;
    const userId = authenticatedEvent.user?.userId;

    const result = await dynamoDb.get({
      TableName: DB_TABLE_NAMES.USERS,
      Key: {
        id: userId
      }
    }).promise();

    return formatResponse(200, {
      addresses: result.Item?.addresses
    });

  } catch (error) {
    logger.error('Error fetching address:', error);
    return formatResponse(500, {
      message: 'Could not fetch address'
    });
  }
};