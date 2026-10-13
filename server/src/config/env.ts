import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_hrms_jwt_key_2026_enterprise_mvp',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  PUNCHING_API_MOCK_ENABLED: process.env.PUNCHING_API_MOCK_ENABLED === 'true' || true,
  PUNCHING_API_BASE_URL: process.env.PUNCHING_API_BASE_URL || 'https://api.biometrics.mock-vendor.local/v1',
  PUNCHING_API_KEY: process.env.PUNCHING_API_KEY || 'mock-api-key-xyz-789'
};
