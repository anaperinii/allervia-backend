export class ProfessionalResponseDto {
  id: string;
  specialty: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    fullName: string;
    email: string;
    type: string;
    organizationId: string | null;
  } | null;
}

