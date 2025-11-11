import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FamilyService } from './family.service';
import { AccessTokenGuard } from '../auth/guard/bearer-token.guard';

@UseGuards(AccessTokenGuard)
@Controller('family')
export class FamilyController {
  constructor(
    private readonly familyService: FamilyService,
  ) {}

  /**
   * 사용자 ID를 통한 가족 구성원 목록 조회
   */
  @Get('members/:userId')
  async getMembers(@Param('userId') userId: string) {
    return this.familyService.getFamilyMembersByUserId(userId);
  }

  /**
   * 🔥 호환성 추가: 가족 구성원 목록 조회 - 프론트엔드 호환 (쿼리 파라미터)
   */
  @Get('members')
  async getMembersCompat(@Query('userId') userId?: string, @Query('group_id') group_id?: string) {
    console.log(`🔥 [FamilyController] 프론트엔드 호환 구성원 조회: userId=${userId}, group_id=${group_id}`);
    
    if (userId) {
      return this.familyService.getFamilyMembersByUserId(userId);
    } else if (group_id) {
      return this.familyService.getFamilyMembersByGroupId(group_id);
    } else {
      return { 
        success: false, 
        error: { message: 'userId 또는 group_id 파라미터가 필요합니다.' }
      };
    }
  }

  /**
   * 그룹 ID를 통한 가족 구성원 목록 조회 (대시보드용)
   */
  @Get('members-by-group/:group_id')
  async getMembersByGroupId(@Param('group_id') group_id: string) {
    return this.familyService.getFamilyMembersByGroupId(group_id);
  }

  /**
   * 자녀 구성원 추가 - 새로운 그룹 기반 방식
   */
  @Post('members')
  async addMember(
    @Body()
    data: {
      user_id: string;
      uid: string;
      name: string;
      birthDate: string;
      age: number;
      parentUserId: string;
    },
  ) {
    return this.familyService.addFamilyMember(data);
  }

  /**
   * 🔥 호환성 추가: 가족 구성원 추가 - 프론트엔드 호환 (/join)
   */
  @Post('join')
  async joinFamily(
    @Body()
    data: {
      user_id: string;
      uid: string;
      name: string;
      birthDate: string;
      age: number;
      parentUserId: string;
      parentUuid?: string; // 기존 호환성을 위해 유지
    },
  ) {
    console.log(`🔥 [FamilyController] 프론트엔드 호환 가족 추가:`, data);
    
    // parentUuid를 parentUserId로 변환 (기존 호환성)
    const memberData = {
      ...data,
      parentUserId: data.parentUserId || data.parentUuid || '',
    };
    
    return this.familyService.addFamilyMember(memberData);
  }

  /**
   * 자녀 구성원 정보 수정
   */
  @Put('members/:id')
  async updateMember(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      birthDate?: string | Date;
      age?: number;
    },
  ) {
    // birthDate 타입 변환
    const updateData: any = { ...data };
    if (updateData.birthDate && typeof updateData.birthDate === 'string') {
      updateData.birthDate = new Date(updateData.birthDate);
    }
    
    return this.familyService.updateFamilyMember(id, updateData);
  }

  /**
   * 자녀 구성원 삭제 - 기존 방식
   */
  @Delete('members/:id')
  async deleteMember(@Param('id') id: string) {
    return this.familyService.deleteFamilyMember(id);
  }

  /**
   * 🔥 호환성 추가: 가족 구성원 삭제 - 프론트엔드 호환 (/leave)
   */
  @Post('leave')
  async leaveFamily(@Body() data: { user_id: string; group_id?: string }) {
    console.log(`🔥 [FamilyController] 프론트엔드 호환 가족 탈퇴:`, data);
    
    // user_id를 기반으로 삭제
    return this.familyService.deleteFamilyMember(data.user_id);
  }

  /**
   * 🔥 호환성 추가: 그룹 정보 조회 - 프론트엔드 호환
   */
  @Get('group-info/:userId')
  async getGroupInfo(@Param('userId') userId: string) {
    console.log(`🔥 [FamilyController] 그룹 정보 조회: userId=${userId}`);
    
    try {
      const result = await this.familyService.getFamilyMembersByUserId(userId);
      const firstMember = result.data[0];
      
      return { 
        success: true, 
        data: { 
          group_id: firstMember?.group_id || null,
          message: '그룹 정보 조회 완료'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: { message: '그룹 정보 조회에 실패했습니다.' }
      };
    }
  }

  /**
   * 전체 가족 스케줄 요약 조회 (자녀 기준)
   */
  @Get('dashboard/family-summary/:group_id')
  async getFamilyMedicineSummary(@Param('group_id') group_id: string) {
    return this.familyService.getFamilySummary(group_id);
  }

  /**
   * 🔥 호환성 추가: 기존 API 호환성
   */
  @Get('dashboard/family-summary')
  async getFamilyMedicineSummaryCompat(@Query('group_id') group_id?: string) {
    if (!group_id) {
      return { 
        success: false, 
        error: { message: 'group_id 파라미터가 필요합니다.' }
      };
    }
    return this.familyService.getFamilySummary(group_id);
  }

  /**
   * 🔥 호환성 추가: 기기 연동 상태 확인 - 프론트엔드 호환
   */
  @Get('check-machine/:machine_id')
  async checkMachine(@Param('machine_id') machine_id: string) {
    console.log(`🔥 [FamilyController] 기기 연동 상태 확인: machine_id=${machine_id}`);
    
    try {
      const result = await this.familyService.checkMachineConnection(machine_id);
      
      return {
        success: true,
        data: result,
        message: '기기 연동 상태를 확인했습니다.'
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message || '기기 연동 상태 확인에 실패했습니다.' }
      };
    }
  }
}
