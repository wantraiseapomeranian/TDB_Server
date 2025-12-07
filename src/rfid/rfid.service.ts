import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/users.entity';
import { Repository } from 'typeorm';
import { UserGroupMembership } from '../users/entities/user-group-membership.entity';

@Injectable()
export class RfidService {
  private readonly logger = new Logger(RfidService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserGroupMembership)
    private readonly membershipRepository: Repository<UserGroupMembership>,
  ) {}

  async resolveRfid(uid: string) {
    const upperCaseUid = uid.toUpperCase();

    const user = await this.userRepository.findOne({
      where: { k_uid: upperCaseUid },
    });

    if (!user) {
      return { 
        registered: false,
        register_url: `https://app.example.com/kit/register?uid=${upperCaseUid}`
      };
    }

    const membership = await this.membershipRepository.findOne({
        where: { user_id: user.user_id }
    });

    if (!membership) {
        // This case should ideally not happen for a registered user
        this.logger.error(`사용자 ${user.user_id}의 그룹 정보를 찾을 수 없습니다.`);
        return {
            registered: true,
            user_id: user.user_id,
            group_id: null, // Or handle as an error
            took_today: user.took_today,
        }
    }

    return {
      registered: true,
      user_id: user.user_id,
      group_id: membership.group_id,
      took_today: user.took_today,
    };
  }
}
