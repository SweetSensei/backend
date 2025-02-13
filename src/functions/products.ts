import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { createProductSchema } from 'src/utilities/validations/productValidations';
import logger from 'src/utilities/logger';
import { DB_TABLE_NAMES } from 'src/utilities/constants';
import { formatResponse } from 'src/utilities/response';

const dynamoDb = new DynamoDB.DocumentClient();

interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  image: string;
  quantity: number;
}

export const addProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('POST "/products"');
    
    const body = JSON.parse(event.body as string) as CreateProductRequest;
    
    const { error, value } = createProductSchema.validate(body, { abortEarly: false });
    
    if (error) {
      logger.error('Validation error', { errors: error.details.map(detail => detail.message) });
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const timestamp = new Date().toISOString();
    const product = {
      id: uuidv4(),
      ...value,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await dynamoDb.put({
      TableName: DB_TABLE_NAMES.PRODUCTS as string,
      Item: product,
      ConditionExpression: 'attribute_not_exists(id)',
    }).promise();

    logger.info('Product created successfully');
    return formatResponse(201, {
      message: 'Product created successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Internal server error', { error: errorMessage });
    return formatResponse(500, {
      message: 'Internal server error',
      error: errorMessage
    });
  }
};

export const getProducts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('GET "/products"');

  try {
    const result = await dynamoDb.scan({
      TableName: DB_TABLE_NAMES.PRODUCTS,
    }).promise();

    return formatResponse(200, {
      products: result.Items,
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Could not fetch products',
      }),
    };
  }
};

export const getProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const productId = event.pathParameters?.id;
    
    if (!productId) {
      return formatResponse(400, {
        message: 'Product ID is required'
      });
    }

    const result = await dynamoDb.get({
      TableName: DB_TABLE_NAMES.PRODUCTS,
      Key: {
        id: productId,
      },
    }).promise();

    if (!result.Item) {
      return formatResponse(400, {
        message: 'Product not found'
      });
    }

    return formatResponse(200, {
      product: result.Item
    });
  } catch (error) {
    logger.error('Error fetching product:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Could not fetch product',
      }),
    };
  }
}; 