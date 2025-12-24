import { UserType } from '@prisma/client';

interface UserProps {
  id: string;
  fullName: string;
  email: string;
  password: string; 
  type: UserType;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserProps {
  fullName: string;
  email: string;
  password: string;
  type: UserType;
  organizationId?: string | null;
}

export class User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  type: UserType;
  organizationId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.email = props.email;
    this.password = props.password;
    this.type = props.type;
    this.organizationId = props.organizationId;
    this.isActive = props.isActive;
    this.isArchived = props.isArchived;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createNew(props: CreateUserProps) {
    return {
      fullName: props.fullName.trim(),
      email: props.email.toLowerCase(),
      password: props.password,
      type: props.type,
      organizationId: props.organizationId || null,
      isActive: true,
      isArchived: false
    };
  }

  updateProfile(fullName?: string, email?: string): void {
    if (fullName !== undefined) {
      this.fullName = fullName.trim();
    }

    if (email !== undefined) {
      this.email = email;
    }
  }

  updatePassword(hashedPassword: string): void {
    this.password = hashedPassword;
  }

  activate(): void {
    if (this.isArchived) {
      throw new Error('Cannot activate an archived user'); 
    }
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  archive(): void {
    this.isArchived = true;
    this.isActive = false;
  }

  unarchive(): void {
    this.isArchived = false;
    this.isActive = true;
  }
}

