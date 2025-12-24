import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma/prisma.service";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { User } from "../../domain/entities/user.entity";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { UserCreationData, UserUpdateData } from "src/account/domain/contracts/types/account.types";
import { ITransactionContext } from "src/database/transaction.interface";


@Injectable()
export class PrismaUserRepository extends IUserRepository {
    constructor(private prismaService: PrismaService) { super() }
    
    async create(user: UserCreationData, tx?: ITransactionContext): Promise<User> {

        const prismaClient = this.prismaService.getClient(tx);

        const created = await prismaClient.user.create({
            data: user
        });

        return new User(created);
    }

    async update(user: Partial<UserUpdateData>, tx?: ITransactionContext): Promise<User> {

        const prismaClient = this.prismaService.getClient(tx);

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

    async delete(id: string, tx?: ITransactionContext): Promise<boolean> {

        const prismaClient = this.prismaService.getClient(tx);

        await prismaClient.user.update({
            where: { id },
            data: {
                isActive: false,
                isArchived: true
            },
        });

        return true;
    }

    async findUserByEmail(email: string, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext): Promise<User | null> {

        const prismaClient = this.prismaService.getClient(tx);

        const user = await prismaClient.user.findFirst({
            where: {
                email,
                organizationId: currentUser.activeOrgId,
            },
        });
        
        return user ? new User(user) : null;
    }

    async findUserById(id: string, organizationId: string, tx?: ITransactionContext): Promise<User | null> {
        
        const prismaClient = this.prismaService.getClient(tx);;

        const user = await prismaClient.user.findFirst({
            where: {
                id: id,
                organizationId: organizationId,
            },
        });
        
        return user ? new User(user) : null;
    }

    async findUserSystemById(id: string, tx?: ITransactionContext): Promise<User | null> {
        
        const prismaClient = this.prismaService.getClient(tx);

        const user = await prismaClient.user.findFirst({
            where: {
                id,
                type: 'SYSTEM_ADMIN'
            },
        });
        
        return user ? new User(user) : null;
    }

    async existsByEmail(email: string, tx?: ITransactionContext): Promise<boolean> {

        const prismaClient = this.prismaService.getClient(tx);

        const count = await prismaClient.user.count({
            where: { email },
        });
        return count > 0;
    }
}