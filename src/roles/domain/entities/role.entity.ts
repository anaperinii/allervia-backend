import { RoleType } from '@prisma/client';

interface RoleProps {
  id: string;
  name: RoleType;
  description: string | null;
  organizationId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleProps {
  name: RoleType;
  description: string | null;
  organizationId: string | null;
}

export class Role {
  id: string;
  name: RoleType;
  description: string | null;
  organizationId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: RoleProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description || null;
    this.organizationId = props.organizationId || null;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createNew(props: CreateRoleProps) {
    return {
      name: props.name,
      description: props.description || null,
      organizationId: props.organizationId,
      isActive: true
    }
  }

  update(description?: string | null): void {
    if (description !== undefined) {
      this.description = description?.trim() ?? null;
    }
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}