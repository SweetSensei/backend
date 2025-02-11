import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { signupSchema } from 'src/utilities/validations/userValidations';
import logger from 'src/utilities/logger';
import { DB_TABLE_NAMES } from 'src/utilities/constants';

const dynamoDb = new DynamoDB.DocumentClient();

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
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        }),
      };
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
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: 'User with this email already exists',
        }),
      };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedBody.password, salt);

    const timestamp = new Date().toISOString();
    const user = {
      id: uuidv4(),
      email: validatedBody.email,
      name: validatedBody.name,
      password: hashedPassword,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await dynamoDb.put({
      TableName: DB_TABLE_NAMES.USERS as string,
      Item: user,
      ConditionExpression: 'attribute_not_exists(id)',
    }).promise();

    logger.info('User created successfully');

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'User created successfully',
      }),
    };

  }catch(error){

    if (error instanceof Error) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.info('User already exists');
        return {
          statusCode: 409,
          body: JSON.stringify({
            message: 'User already exists',
          }),
        };
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Internal server error', { error: errorMessage });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: errorMessage,
      }),
    };

  }
};