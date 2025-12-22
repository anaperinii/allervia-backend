import { ulid } from 'ulid';

interface OrganizationProps {
  id?: string;
  name: string;
  taxId: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  id: string;
  name: string;
  taxId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: OrganizationProps) {
    this.id = props.id || ulid();
    this.name = props.name.trim();
    this.taxId = props.taxId;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      taxId: this.taxId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

