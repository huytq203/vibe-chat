import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development')
    .required(),

  PORT: Joi.number().port().default(3001),
  APP_NAME: Joi.string().default('vibe-chat'),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),

  DB_TYPE: Joi.string().valid('mysql').default('mysql'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(4000),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SSL: Joi.boolean().default(true),
  DB_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(200).default(10),
  DB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),

  KEYCLOAK_BASE_URL: Joi.string().uri().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),

  MESSAGE_ENCRYPTION_KEK_BASE64: Joi.string().base64().required(),

  CORS_ORIGINS: Joi.string().default(''),
});
