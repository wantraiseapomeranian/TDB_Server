import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { BasicTokenGuard } from './guard/basic-token.guard';
import {
  AccessTokenGuard,
  RefreshTokenGuard,
} from './guard/bearer-token.guard';
import { UnauthorizedException } from '@nestjs/common';
import { SignupDto } from './dto/Signtp.dto';
import { Request } from 'express';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiOperation, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// BasicTokenGuard에서 req.user에 추가하는 정보 타입 정의
interface BasicAuthUser {
  user_id: string;
  password: string;
}

// JWT 토큰 페이로드 타입 정의 (AuthService.TokenPayload와 일치)
interface TokenPayload {
  sub: string;
  role: UserRole;
  groupId?: string;
  type?: 'access' | 'refresh' | 'device';
  iat: number;
  exp: number;
}

// generateTokens용 사용자 타입 정의
interface TokenGenerationUser {
  user_id: string;
  role: UserRole;
  groupId: string;
}

// 인증된 요청 인터페이스들
interface BasicAuthRequest extends Request {
  user?: BasicAuthUser;
}

interface TokenAuthRequest extends Request {
  user?: TokenPayload;
}

interface RefreshTokenRequest extends Request {
  user?: TokenGenerationUser;
}

// 기기 로그인 요청 시 사용할 DTO (Data Transfer Object)
class DeviceLoginDto {
  @IsString()
  @IsNotEmpty()
  //@ApiProperty({ description: '기기 고유 ID', example: 'MACHINE-0001' })
  machineId: string;

  @IsString()
  @IsNotEmpty()
  //@ApiProperty({ description: '기기 비밀 키', example: 'SUPER_SECRET_KEY_1' })
  secretKey: string;
}

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 기기 로그인 (JWT 발급)
   */
  @Post('device/login')
  @ApiOperation({
    summary: '기기 로그인',
    description: '기기 ID와 시크릿 키로 인증하여, API 접근용 JWT를 발급받습니다.',
  })
  @ApiBody({ type: DeviceLoginDto })
  @ApiResponse({ status: 200, description: '기기 로그인 성공, 토큰 발급' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async loginDevice(@Body(ValidationPipe) body: DeviceLoginDto) {
    this.logger.log(`[Device] 로그인 요청: ${body.machineId}`);
    return this.authService.loginDevice(body);
  }

  /**
   * 로그인 API
   */
  @Post('login')
  @ApiOperation({
    summary: '로그인',
    description: '사용자 ID와 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', example: 'test_user' },
        password: { type: 'string', example: 'password123' },
      },
      required: ['user_id', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            user: { type: 'object' },
          },
        },
      },
    },
  })
  async login(@Body() body: { user_id: string; password: string }) {
    const result = await this.authService.login(body.user_id, body.password);
    return result;
  }

  /**
   * 회원가입 API - register와 signup 둘 다 지원
   */
  @Post('register')
  @ApiOperation({
    summary: '회원가입',
    description: '새 사용자 계정을 생성합니다.',
  })
  async register(@Body() signupDto: SignupDto) {
    this.logger.log(`register 요청 - ID: ${signupDto.id}`);
    return this.authService.signup(signupDto);
  }

  @Post('signup') // 프론트엔드 호환성을 위해 추가
  @ApiOperation({
    summary: '회원가입 (프론트엔드 호환)',
    description: '새 사용자 계정을 생성합니다. (프론트엔드 API 호환성)',
  })
  async signup(@Body() signupDto: SignupDto) {
    this.logger.log(`signup 요청 - ID: ${signupDto.id}`);
    return this.authService.signup(signupDto);
  }

  /**
   * 로그아웃
   */
  @Post('logout')
  async logout(@Body('id') id: string) {
    this.logger.log(`로그아웃 요청 - ID: ${id}`);
    return this.authService.logout(id);
  }

  /**
   * 인증 상태 확인 (Access Token) - 기존 경로
   */
  @Get('check-auth')
  @UseGuards(AccessTokenGuard)
  async checkAuth(@Req() req: TokenAuthRequest) {
    const user = req.user;

    if (!user) {
      this.logger.error('인증된 사용자 정보가 없습니다.');
      throw new UnauthorizedException('인증된 사용자 정보가 없습니다.');
    }

    this.logger.log(`check-auth 요청 - user: ${user.sub}`);
    return this.authService.checkAuth(user);
  }

  /**
   * 🔥 호환성 추가: 인증 상태 확인 - 프론트엔드 호환 경로
   */
  @Get('verify')
  @UseGuards(AccessTokenGuard)
  async verify(@Req() req: TokenAuthRequest) {
    const user = req.user;

    if (!user) {
      this.logger.error('인증된 사용자 정보가 없습니다.');
      throw new UnauthorizedException('인증된 사용자 정보가 없습니다.');
    }

    this.logger.log(`verify 요청 (프론트엔드 호환) - user: ${user.sub}`);
    return this.authService.checkAuth(user);
  }

  /**
   * 토큰 재발급 (Refresh Token)
   */
  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(@Req() req: RefreshTokenRequest) {
    const user = req.user;

    if (!user || !user.user_id || !user.role || !user.groupId) {
      this.logger.error('토큰 재발급을 위한 사용자 정보가 없습니다.');
      throw new UnauthorizedException(
        '토큰 재발급을 위한 사용자 정보가 없습니다.',
      );
    }

    try {
      const { accessToken, refreshToken } =
        this.authService.generateTokens(user, user.role, user.groupId);
      await this.authService.updateRefreshToken(user.user_id, refreshToken);

      return {
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Refresh 실패: ${errorMessage}`);
      throw error;
    }
  }
}
