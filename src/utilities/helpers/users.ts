import { DynamoDB } from 'aws-sdk';
import { DB_TABLE_NAMES } from '../constants';
import logger from '../logger';

const dynamoDb = new DynamoDB.DocumentClient();

export const generatePartnerCode = async () => {
     let partnerCode = generateUniquePartnerCode();
     let uniqueCodeFound = false;
    
       while (!uniqueCodeFound) {
      
      const partnerCodeExists = await dynamoDb.scan({
        TableName: DB_TABLE_NAMES.USERS,
        FilterExpression: 'partnerCode = :partnerCode',
        ExpressionAttributeValues: {
          ':partnerCode': partnerCode
        }
      }).promise();

      if (!partnerCodeExists.Items || partnerCodeExists.Items.length === 0) {
        uniqueCodeFound = true;
      }

    logger.info('Partner code exists:', { partnerCode });

      partnerCode = generateUniquePartnerCode();

    }

    return partnerCode;
    };


 const generateUniquePartnerCode = () => {
     // Generate a code with format: XX123XX (2 letters + 3 numbers + 2 letters)
     const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
     const numbers = '0123456789';
      
      const getRandomChars = (chars: string, length: number) => 
        Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      
      return `${getRandomChars(letters, 2)}${getRandomChars(numbers, 3)}${getRandomChars(letters, 2)}`;
}