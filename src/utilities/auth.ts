import { APIGatewayProxyEvent } from 'aws-lambda';
import { authenticate, AuthorizedEvent } from 'src/middleware/auth';

interface AuthResult {
  statusCode?: number;
  userId?: string;
}

export const validateAuth = async (event: APIGatewayProxyEvent): Promise<AuthResult> => {
  const authResult = await authenticate(event);
  
  if ('statusCode' in authResult) {
    return { statusCode: authResult.statusCode };
  }

  const authenticatedEvent = authResult as AuthorizedEvent;
  return { userId: authenticatedEvent.user?.userId };
}; 