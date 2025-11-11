// jwt.strategy.ts - JWT 인증 전략
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload) {
    console.debug(`[JWT Validate] Payload received: ${JSON.stringify(payload)}`);

    // 기기 토큰(Device Token)인 경우
    if (payload.type === 'device') {
      console.log(`[JWT Validate] Device token identified for machine: ${payload.sub}`);
      // TODO: 추후 MachineService를 주입받아 실제 기기가 DB에 존재하는지 확인하는 로직을 추가하면 보안이 강화됩니다.
      const deviceInfo = {
        id: payload.sub, // machine_id
        type: 'device',
      };
      console.debug(`[JWT Validate] Returning device info: ${JSON.stringify(deviceInfo)}`);
      return deviceInfo;
    }

    // 사용자 토큰(User Token)인 경우
    console.log(`[JWT Validate] User token identified for user: ${payload.sub}`);
    const userInfo = {
      id: payload.sub, // user_id
      role: payload.role,
      groupId: payload.groupId,
      type: payload.type,
    };
    console.debug(`[JWT Validate] Returning user info: ${JSON.stringify(userInfo)}`);
    return userInfo;
  }
}
 