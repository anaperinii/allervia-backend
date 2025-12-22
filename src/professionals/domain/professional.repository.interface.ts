import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { CreateProfessionalProps, Professional } from "./entities/professional.entity";
import { Prisma } from "@prisma/client";

export abstract class IProfessionalRepository {
    abstract create(professional: CreateProfessionalProps, tx?: Prisma.TransactionClient): Promise<Professional>;
    abstract update(professional: Professional, tx?: Prisma.TransactionClient): Promise<Professional>;
    abstract findAllProfessionals(): Promise<Professional[]>;
    abstract findAllProfessionalByOrgId(orgId: string): Promise<Professional[]>; 
    abstract findProfessionalById(id: string, currentUser: AuthenticatedUserPayload): Promise<Professional | null>;
    abstract findProfessionalByUserId(userId: string): Promise<Professional | null>;
    abstract exists(id: string, organizationId: string): Promise<boolean>;
}