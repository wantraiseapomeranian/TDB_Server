// health.controller.ts - 서버 상태 확인 (앱 + 라즈베리파이)
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { 
  HealthCheckService, 
  HealthCheck, 
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator 
} from '@nestjs/terminus';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: '서버 전체 상태 확인',
    description: '데이터베이스, 메모리, 디스크 상태를 종합적으로 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '서버 상태 정상',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            memory_heap: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            memory_rss: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            disk: { type: 'object', properties: { status: { type: 'string', example: 'up' } } }
          }
        },
        error: { type: 'object' },
        details: {
          type: 'object',
          properties: {
            database: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            memory_heap: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            memory_rss: { type: 'object', properties: { status: { type: 'string', example: 'up' } } },
            disk: { type: 'object', properties: { status: { type: 'string', example: 'up' } } }
          }
        }
      }
    }
  })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  @Get('db')
  @HealthCheck()
  @ApiOperation({
    summary: '데이터베이스 연결 상태 확인',
    description: 'MySQL 데이터베이스 연결 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '데이터베이스 연결 정상',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: { type: 'object', properties: { status: { type: 'string', example: 'up' } } }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 503,
    description: '데이터베이스 연결 실패'
  })
  checkDatabase() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('status')
  @ApiOperation({
    summary: '서버 기본 상태 정보',
    description: '서버 가동 시간, 버전 정보 등 기본적인 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '서버 상태 정보',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'running' },
        uptime: { type: 'number', description: '서버 가동 시간(초)', example: 3600 },
        timestamp: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00Z' },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'development' },
        memory: {
          type: 'object',
          properties: {
            used: { type: 'number', description: '사용 메모리(MB)', example: 45.2 },
            total: { type: 'number', description: '전체 메모리(MB)', example: 512.0 }
          }
        }
      }
    }
  })
  getStatus() {
    const memUsage = process.memoryUsage();
    return {
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      },
      node_version: process.version,
    };
  }

  @Get('pi-connections')
  @ApiOperation({
    summary: '라즈베리파이 연결 상태',
    description: '현재 연결된 라즈베리파이 디바이스들의 상태를 확인합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '라즈베리파이 연결 정보',
    schema: {
      type: 'object',
      properties: {
        connected_devices: { type: 'number', example: 2 },
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              device_id: { type: 'string', example: 'pi-001' },
              last_seen: { type: 'string', format: 'date-time' },
              status: { type: 'string', example: 'active' }
            }
          }
        }
      }
    }
  })
  getPiConnections() {
    // 향후 실제 라즈베리파이 연결 추적 로직 구현 예정
    return {
      connected_devices: 0,
      devices: [],
      message: '라즈베리파이 연결 추적 기능은 개발 중입니다.'
    };
  }
} 