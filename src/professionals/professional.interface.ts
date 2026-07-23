import { Profession } from '@prisma/client';

export interface CreateProfessionalData {
  userId: string;
  organizationId: string;
  fullName: string;
  phoneNumber: string;
  profession: Profession;
  councilNumber?: string | null;
  councilUf?: string | null;
}

export interface UpdateProfessionalData {
  id: string;
  fullName?: string;
  phoneNumber?: string;
  profession?: Profession;
  councilNumber?: string | null;
  councilUf?: string | null;
}
