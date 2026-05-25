import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'pos',
  password: process.env.DB_PASSWORD || 'pos',
  database: process.env.DB_DATABASE || 'posdb',
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));

export const mailerConfig = registerAs('mailer', () => ({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || 'noreply@posapp.com',
}));

export const uploadConfig = registerAs('upload', () => ({
  dest: process.env.UPLOAD_DEST || './uploads',
  maxSizeMb: parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 10,
  allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const storageConfig = registerAs('storage', () => ({
  accountId:       process.env.R2_ACCOUNT_ID || '',
  accessKeyId:     process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket:          process.env.R2_BUCKET || '',
  publicUrl:       process.env.R2_PUBLIC_URL || '',  // e.g. https://pub.r2.dev/your-bucket or custom domain
}));

export const authConfig = registerAs('auth', () => ({
  maxLoginAttempts: parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS, 10) || 5,
  lockDurationMinutes: parseInt(process.env.AUTH_LOCK_DURATION_MINUTES, 10) || 15,
  passwordResetExpiryHours: parseInt(process.env.AUTH_PASSWORD_RESET_EXPIRY_HOURS, 10) || 1,
  emailVerifyExpiryHours: parseInt(process.env.AUTH_EMAIL_VERIFY_EXPIRY_HOURS, 10) || 24,
}));

export const chatConfig = registerAs('chat', () => ({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CHAT_MODEL || 'claude-opus-4-7',
  maxTokens: parseInt(process.env.CHAT_MAX_TOKENS, 10) || 1024,
  maxHistoryMessages: parseInt(process.env.CHAT_MAX_HISTORY, 10) || 20,
}));
