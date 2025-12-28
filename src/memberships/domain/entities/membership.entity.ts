import { CreateMembershipProps } from "../contracts/memberships.interface";

interface MembershipProps {
  id: string;
  userId: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Membership {
  id: string;
  userId: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: MembershipProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.organizationId = props.organizationId;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createNew(props: CreateMembershipProps) {
    return {
      userId: props.userId,
      organizationId: props.organizationId
    }
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }
}