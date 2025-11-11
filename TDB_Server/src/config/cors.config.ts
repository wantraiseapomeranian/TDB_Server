// cors.config.ts - CORS 설정 (앱 + 라즈베리파이 지원)
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsConfig: CorsOptions = {
  origin: [
    // 모바일 앱 (개발/운영)
    'http://localhost:3000',
    'http://localhost:19006', // Expo 개발 서버
    'http://192.168.*.*:*', // 로컬 네트워크
    
    // 라즈베리파이 (모든 IP 허용)
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-Type', // 'app' | 'pi'
    'X-Device-ID',
    'X-Machine-UID',
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}; 