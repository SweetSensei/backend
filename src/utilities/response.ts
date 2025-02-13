const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Content-Type': 'application/json',
};

export const formatResponse = (statusCode: number, body: Record<string, unknown>) => {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}; 