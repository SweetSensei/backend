import * as Joi from 'joi';

export const signupSchema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .lowercase()
      .trim(),
    password: Joi.string()
      .min(6)
      .required()
      .trim()
  });

    // return {
  //   statusCode: 200,
  //   body: JSON.stringify(
  //     {
  //       message: "Go Serverless v1.0! Your function executed successfully!",
  //       input: event,
  //     },
  //     null,
  //     2,
  //   ),
  // };