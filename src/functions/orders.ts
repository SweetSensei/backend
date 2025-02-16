import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from 'aws-sdk';
import { formatResponse } from 'src/utilities/response';
import logger from 'src/utilities/logger';
import { completeOrderSchema, createStripeSessionSchema } from 'src/utilities/validations/orderValidations';
import { DB_TABLE_NAMES } from 'src/utilities/constants';
import { validateAuth } from 'src/utilities/auth';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16' as const
// });

const dynamoDb = new DynamoDB.DocumentClient();

interface CartItem {
  id: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
}

export const createStripeSession = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('POST "/orders/create-stripe-checkout-session"');

    const { statusCode, userId } = await validateAuth(event);
    if (statusCode) {
      return formatResponse(statusCode, { message: 'Unauthorized' });
    }

    const { error, value } = createStripeSessionSchema.validate(JSON.parse(event.body as string), { abortEarly: false });

    if (error) {
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { items } = value as { items: CartItem[] };

     // Get all product details from database
    const productDetails = await Promise.all(items.map(async (item) => {
      const result = await dynamoDb.get({
        TableName: DB_TABLE_NAMES.PRODUCTS,
        Key: {
          id: item.id
        }
      }).promise();
      
      const product = result.Item;
      if (!product) {
        return formatResponse(400, {
          message: `Product with ID ${item.id} not found`
        });
      }

    // Validate product quantities
      if (product.quantity < item.quantity) {
        return formatResponse(400, {
          message: `Insufficient stock for product "${product.name}". Available: ${product.quantity}, Requested: ${item.quantity}`
        });
      }
      
      return {
        ...item,
        price: product.price,
        image: product.image
      };
    }));

    // Filter out error responses
    const validProducts = productDetails.filter(item => !('statusCode' in item)) as CartItem[];
    if (validProducts.length !== items.length) {
      return formatResponse(400, { message: 'One or more products are invalid' });
    }

    // Create Stripe checkout session with verified prices
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: validProducts.map(item => ({
    //     price_data: {
    //       currency: 'usd',
    //       product_data: {
    //         name: item.name,
    //         images: [item.image],
    //       },
    //       unit_amount: Math.round(item.price * 100), // Convert verified price to cents
    //     },
    //     quantity: item.quantity,
    //   })),
    //   mode: 'payment',
    //   success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${process.env.CLIENT_URL}/cart`,
    // });

    const sessionId = Date.now().toString();

    // Create order in database with status pending_payment
    const order = {
      id: uuidv4(),
      userId,
      stripeSessionId: sessionId,
      orderStatus: 'pending_payment',
      items: validProducts.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
      })),
      totalAmount: validProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      shippingAddress: value.shippingAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamoDb.put({
      TableName: DB_TABLE_NAMES.ORDERS,
      Item: order
    }).promise();

    return formatResponse(200, {
      sessionId,
      orderId: order.id
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return formatResponse(500, {
      message: 'Error creating checkout session',
    });
  }
};

export const completeOrder = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { statusCode, userId } = await validateAuth(event);
    if (statusCode) {
      return formatResponse(statusCode, { message: 'Unauthorized' });
    }

    const { error, value } = completeOrderSchema.validate(JSON.parse(event.body as string), { abortEarly: false });

    if (error) {
      return formatResponse(400, {
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { orderId } = value

    // Fetch order details
    const orderResult = await dynamoDb.get({
      TableName: DB_TABLE_NAMES.ORDERS,
      Key: { id: orderId }
    }).promise();

    const order = orderResult.Item;
    if (!order) {
      return formatResponse(400, { message: 'Order not found' });
    }

    if (order.orderStatus === 'paid') {
      return formatResponse(400, { message: 'Order is already paid' });
    }

    // Update product quantities
    for (const item of order.items) {
      // Get current product quantity
      const productResult = await dynamoDb.get({
        TableName: DB_TABLE_NAMES.PRODUCTS,
        Key: { id: item.id }
      }).promise();

      const product = productResult.Item;
      if (!product) {
        return formatResponse(400, { 
          message: `Product ${item.id} not found` 
        });
      }

      if (product.quantity < item.quantity) {
        return formatResponse(400, { 
          message: `Insufficient stock for product "${product.name}". Available: ${product.quantity}, Required: ${item.quantity}` 
        });
      }

      // Update product quantity
      await dynamoDb.update({
        TableName: DB_TABLE_NAMES.PRODUCTS,
        Key: { id: item.id },
        UpdateExpression: 'SET quantity = :newQuantity, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':newQuantity': product.quantity - item.quantity,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
    }

    // Update order status to paid
    await dynamoDb.update({
      TableName: DB_TABLE_NAMES.ORDERS,
      Key: { id: orderId },
      UpdateExpression: 'SET orderStatus = :orderStatus, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':orderStatus': 'paid',
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    return formatResponse(200, {
      message: 'Order completed successfully',
      orderId
    });

  } catch (error) {
    logger.error('Error completing order:', error);
    return formatResponse(500, {
      message: 'Could not complete order'
    });
  }
};

export const getOrders = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('GET "/orders"');

    const { statusCode, userId } = await validateAuth(event);
    if (statusCode) {
      return formatResponse(statusCode, { message: 'Unauthorized' });
    }

    // Get all orders for user
    const result = await dynamoDb.scan({
      TableName: DB_TABLE_NAMES.ORDERS,
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    return formatResponse(200, {
      orders: result.Items || []
    });

  } catch (error) {
    logger.error('Error fetching orders:', error);
    return formatResponse(500, {
      message: 'Could not fetch orders'
    });
  }
}; 