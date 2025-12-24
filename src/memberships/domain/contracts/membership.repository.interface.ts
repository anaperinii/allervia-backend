import { Membership } from '../entities/membership.entity';
import { CreateMembershipProps, MembershipInfo, UpdateMembershipData } from './interfaces/memberships.interface';

export abstract class IMembershipRepository {
  abstract create(membership: CreateMembershipProps): Promise<Membership>;
  abstract update(id: string, membership: Partial<UpdateMembershipData>): Promise<Membership>;
  abstract findById(id: string): Promise<Membership | null>;
  abstract findByUserId(userId: string): Promise<MembershipInfo[]>;
  abstract findByUserAndOrganization(userId: string, organizationId: string): Promise<Membership | null>;
  abstract exists(userId: string, organizationId: string): Promise<boolean>;
}
