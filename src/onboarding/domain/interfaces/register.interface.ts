import { Profession } from '@prisma/client';

export interface RegisterUser {
  userId: string;
  professionalId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  profession: Profession;
}
