import * as Joi from 'joi';

export const addAddressSchema = Joi.object({
  name: Joi.string().required().trim(),
  street: Joi.string().required().trim(),
  city: Joi.string().required().trim(),
  state: Joi.string().required().trim(),
  country: Joi.string().required().trim(),
  zipCode: Joi.string().required().trim(),
  phone: Joi.string().required().trim(),
  isDefault: Joi.boolean().default(false),
});

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

export const loginSchema = Joi.object({
  email: Joi.string().required().email().trim().lowercase(),
  password: Joi.string().required(),
});