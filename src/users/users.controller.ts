import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './entities/user-role.enum';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 전체 유저 조회
  @Get()
  async getAllUsers() {
    const users = await this.usersService.getAllUsers();
    return { success: true, data: users };
  }

  // user_id로 유저 조회
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.getUserById(id);
    return { success: true, data: user };
  }

  // k_uid로 유저 조회
  @Get('/kit/:k_uid')
  async getUserByKitUid(@Param('k_uid') k_uid: string) {
    const user = await this.usersService.getUserByKitUid(k_uid);
    return { success: true, data: user };
  }

  // 사용자의 그룹 정보 조회
  @Get(':userId/group')
  async getUserGroup(@Param('userId') userId: string) {
    const result = await this.usersService.getUserWithGroup(userId);
    return { success: true, data: result };
  }

  // 부모 user_id 기준 자녀 목록 조회
  @Get('/children/:parent_id')
  async getChildrenOfParent(@Param('parent_id') parent_id: string) {
    const children = await this.usersService.getChildrenOfParent(parent_id);
    return { success: true, data: children };
  }

  // 그룹의 모든 멤버 조회
  @Get('/group/:groupId/members')
  async getGroupMembers(@Param('groupId') groupId: string) {
    const members = await this.usersService.getGroupMembers(groupId);
    return { success: true, data: members };
  }

  // 🔥 디스펜서 등록 API
  @Post('register-dispenser')
  async registerDispenser(@Body() body: { userId: string; machine_id: string }) {
    console.log(`[Controller] 디스펜서 등록 요청: userId=${body.userId}, machine_id=${body.machine_id}`);
    
    const result = await this.usersService.registerDispenser(body.userId, body.machine_id);
    return { success: true, data: result };
  }

  // 🔥 데일리 키트 등록 API
  @Post('register-daily-kit')
  async registerDailyKit(@Body() body: { userId: string; k_uid: string }) {
    const result = await this.usersService.registerDailyKit(body.userId, body.k_uid);
    return { success: true, data: result };
  }

  // 🔥 디스펜서 정보 조회 API
  @Get(':userId/dispenser-info')
  async getDispenserInfo(@Param('userId') userId: string) {
    console.log(`[Controller] 디스펜서 정보 조회 요청: userId=${userId}`);
    
    const result = await this.usersService.getDispenserInfo(userId);
    return { success: true, data: result };
  }

  // 🔥 사용자 생성 API
  @Post('create')
  async createUser(@Body() body: { 
    userData: any; 
    role?: UserRole; 
    parentUserId?: string 
  }) {
    console.log(`[Controller] 사용자 생성 요청:`, body.userData);
    
    const result = await this.usersService.createUser(
      body.userData, 
      body.role || UserRole.CHILD, 
      body.parentUserId
    );
    return { success: true, data: result };
  }

  // 그룹 정보 조회
  @Get('/group/:groupId')
  async getGroupInfo(@Param('groupId') groupId: string) {
    const group = await this.usersService.getGroupInfo(groupId);
    return { success: true, data: group };
  }
}

/**
 * 🔥 호환성 추가: /users/ 경로 지원 (프론트엔드 호환용)
 */
@Controller('users')
export class UsersCompatController {
  constructor(private readonly usersService: UsersService) {}

  // 🔥 디스펜서 등록 API - 프론트엔드 호환 경로
  @Post('register-dispenser')
  async registerDispenser(@Body() body: { userId: string; machine_id: string }) {
    console.log(`[CompatController] 프론트엔드 호환 디스펜서 등록: userId=${body.userId}, machine_id=${body.machine_id}`);
    
    const result = await this.usersService.registerDispenser(body.userId, body.machine_id);
    return { success: true, data: result };
  }

  // 🔥 프로필 조회 API - 프론트엔드 호환
  @Get('profile')
  async getProfile() {
    // TODO: 실제 프로필 로직 구현 필요
    console.log(`[CompatController] 프로필 조회 요청 - 구현 필요`);
    return { 
      success: true, 
      data: { message: '프로필 API는 아직 구현되지 않았습니다.' }
    };
  }

  // 🔥 프로필 업데이트 API - 프론트엔드 호환
  @Post('profile')
  async updateProfile(@Body() body: any) {
    // TODO: 실제 프로필 업데이트 로직 구현 필요
    console.log(`[CompatController] 프로필 업데이트 요청 - 구현 필요`, body);
    return { 
      success: true, 
      data: { message: '프로필 업데이트 API는 아직 구현되지 않았습니다.' }
    };
  }

  // 🔥 전체 사용자 목록 - 프론트엔드 호환
  @Get()
  async getAllUsers() {
    const users = await this.usersService.getAllUsers();
    return { success: true, data: users };
  }
}
