import { Injectable, Logger } from '@nestjs/common';

interface DeviceEventDto {
    machine_id: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    code?: string;
    message: string;
    ts: string;
    extra?: Record<string, any>;
}

@Injectable()
export class DeviceService {
  private readonly deviceLogger = new Logger('DeviceEvent');

  async logEvent(event: DeviceEventDto) {
    const logObject = {
        machine: event.machine_id,
        code: event.code,
        ...event.extra
    };

    // TODO: 운영 환경에서는 이 로그를 Console이 아닌 Sentry, Datadog, ELK 등 전문 로깅 서비스로 보내야 합니다.
    switch(event.level) {
        case 'ERROR':
            this.deviceLogger.error(event.message, JSON.stringify(logObject));
            break;
        case 'WARN':
            this.deviceLogger.warn(event.message, JSON.stringify(logObject));
            break;
        case 'INFO':
        default:
            this.deviceLogger.log(event.message, JSON.stringify(logObject));
            break;
    }

    return { status: "logged" };
  }
}
