import * as Joi from 'joi';

export const createStripeSessionSchema = Joi.object({
  items: Joi.array().required(),
  shippingAddress: Joi.object({
    name: Joi.string().required(),
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    phone: Joi.string().required(),
    country: Joi.string().required()
  }).required()
});

export const completeOrderSchema = Joi.object({
  orderId: Joi.string().required()
});
