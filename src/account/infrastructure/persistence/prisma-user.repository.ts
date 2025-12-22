import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { User } from "../../domain/entities/user.entity";
import { Prisma } from "@prisma/client";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { UserCreationData, UserUpdateData } from "src/account/domain/contracts/interfaces/account.interface";

@Injectable()
export class PrismaUserRepository extends IUserRepository {
    constructor(private prismaService: PrismaService) { super() }
    
    async create(user: UserCreationData, tx?: Prisma.TransactionClient): Promise<User> {

        const prismaClient = tx || this.prismaService;

        const created = await prismaClient.user.create({
            data: user
        });

        return new User(created);
    }

    async update(user: Partial<UserUpdateData>, tx?: Prisma.TransactionClient): Promise<User> {

        const prismaClient = tx || this.prismaService;

        const updated = await prismaClient.user.update({
                where: { id: user.id },
                data: {
                    fullName: user.fullName,
                    email: user.email,
                    password: user.password, 
                    isActive: user.isActive,
                    isArchived: user.isArchived
                },
            });

        return new User(updated);
    }

    async delete(id: string, tx?: Prisma.TransactionClient): Promise<boolean> {

        const prismaClient = tx || this.prismaService;

        await prismaClient.user.update({
            where: { id },
            data: {
                isActive: false,
                isArchived: true
            },
        });

        return true;
    }

    async findUserByEmail(email: string, currentUser: AuthenticatedUserPayload, tx?: Prisma.TransactionClient): Promise<User | null> {

        const prismaClient = tx || this.prismaService;

        const user = await prismaClient.user.findFirst({
            where: {
                email,
                organizationId: currentUser.activeOrgId,
            },
        });
        
        return user ? new User(user) : null;
    }

    async findUserById(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<User | null> {
        
        const prismaClient = tx || this.prismaService;

        const user = await prismaClient.user.findFirst({
            where: {
                id,
                organizationId: organizationId,
            },
        });
        
        return user ? new User(user) : null;
    }

    async findUserSystemById(id: string, tx?: Prisma.TransactionClient): Promise<User | null> {
        
        const prismaClient = tx || this.prismaService;

        const user = await prismaClient.user.findFirst({
            where: {
                id,
                type: 'SYSTEM_ADMIN'
            },
        });
        
        return user ? new User(user) : null;
    }

    async existsByEmail(email: string, tx?: Prisma.TransactionClient): Promise<boolean> {

        const prismaClient = tx || this.prismaService;

        const count = await prismaClient.user.count({
            where: { email },
        });
        return count > 0;
    }

    async exists(id: string, tx?: Prisma.TransactionClient): Promise<boolean> {

        const prismaClient = tx || this.prismaService;

        const count = await prismaClient.user.count({
            where: { id },
        });
        return count > 0;
    }
}