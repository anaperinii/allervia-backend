import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { IProfessionalRepository } from "../../domain/professional.repository.interface";
import { Professional } from "../../domain/entities/professional.entity";
import { Prisma } from "@prisma/client";

@Injectable()
export class ProfessionalPrismaRepository extends IProfessionalRepository {
    constructor(private prismaService: PrismaService) {
        super();
    };

    async create(professional: Professional, tx?: Prisma.TransactionClient): Promise<Professional> {

        const prismaClient = tx || this.prismaService;

        const created = await prismaClient.professional.create({
            data: {
                id: professional.id,
                specialty: professional.specialty,
                phoneNumber: professional.phoneNumber,
                user: { connect: { id: professional.userId } }
            },
        });

        return new Professional(created);
    }

    async update(professional: Professional, tx?: Prisma.TransactionClient): Promise<Professional> {

        const prismaClient = tx || this.prismaService;

        const updated = await prismaClient.professional.update({
        where: { id: professional.id },
        data: professional,
        });

        return new Professional(updated);
    }

    async findAllProfessionals(): Promise<Professional[]> {
        const professionals = await this.prismaService.professional.findMany({
            where: {
                user: {
                    isActive: true
                }
            },
        });

        return professionals.map(p => new Professional(p));
    }

    async findAllProfessionalByOrgId(orgId: string): Promise<Professional[]> {
        const professionals = await this.prismaService.professional.findMany({
            where: {
                user: {
                    organizationId: orgId,
                    isActive: true
                }
            },
        });

        return professionals.map(p => new Professional(p));
    }

    async findProfessionalById(id: string, currentUser: AuthenticatedUserPayload): Promise<Professional | null> {
        const professional = await this.prismaService.professional.findFirst({
            where: {
                id,
                user: {
                    organizationId: currentUser.activeOrgId
                }
            },
        });

        return professional ? new Professional(professional) : null;
    }

    async findProfessionalByUserId(userId: string): Promise<Professional | null> {
        const professional = await this.prismaService.professional.findUnique({
            where: {
                userId
            }
        });

        return professional ? new Professional(professional) : null;
    }

    async exists(id: string, organizationId: string): Promise<boolean> {
        const count = await this.prismaService.professional.count({
            where: {
                id,
                user: {
                    organizationId,
                }
            },
        });

        return count > 0;
    }
}