import Joi from 'joi';

export const createUserSchema = Joi.object({
  email: Joi.string().required().email().trim().lowercase(),
  password: Joi.string().required().min(6),
}); 