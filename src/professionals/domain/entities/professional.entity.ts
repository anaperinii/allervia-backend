interface ProfessionalProps {
  id: string;
  specialty: string;
  phoneNumber: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfessionalProps {
  specialty: string;
  phoneNumber: string;
  userId: string;
}

export class Professional {
  id: string;
  specialty: string;
  phoneNumber: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: ProfessionalProps) {
    this.id = props.id;
    this.specialty = props.specialty.trim();
    this.phoneNumber = props.phoneNumber.trim()
    this.userId = props.userId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createNew(props: CreateProfessionalProps) {
    return {
      specialty: props.specialty,
      phoneNumber: props.phoneNumber,
      userId: props.userId
    }
  }

  update(specialty?: string, phoneNumber?: string): void {
    if (specialty !== undefined) {
      this.specialty = specialty.trim();
    }

    if (phoneNumber !== undefined) {
      this.phoneNumber = phoneNumber.trim();
    }
  }

  toJSON() {
    return {
      id: this.id,
      specialty: this.specialty,
      phoneNumber: this.phoneNumber,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}