import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from 'aws-sdk';
import { formatResponse } from 'src/utilities/response';
import logger from 'src/utilities/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as const
});

const dynamoDb = new DynamoDB.DocumentClient();

interface CartItem {
  id: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
}

export const createSession = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return formatResponse(400,    {
        message: 'Missing request body'
      });
    }

    const { items } = JSON.parse(event.body) as { items: CartItem[] };
    // TODO: Add validation for items
    // TODO: Ensure that prodcut quantity is valid from db
    // TODO: Ensure that product is still available
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    images: [item.image],
                },
          // TODO: Get price from db
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    // Create order in DynamoDB
    const order = {
      id: uuidv4(),
      stripeSessionId: session.id,
      status: 'payment_pending',
      items: items,
      totalAmount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamoDb.put({
      TableName: `${process.env.STAGE}-orders`,
      Item: order
    }).promise();

    return formatResponse(200, {
      sessionId: session.id,
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return formatResponse(500, {
      message: 'Error creating checkout session',
    });
  }
}; 