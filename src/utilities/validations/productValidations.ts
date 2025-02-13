import * as Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().required().trim(),
  description: Joi.string().required().trim(),
  price: Joi.number().required().min(0),
  image: Joi.string().uri().required(),
  quantity: Joi.number().required().min(0),
}); 