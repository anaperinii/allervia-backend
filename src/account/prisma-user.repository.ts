import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { ITransactionContext } from "src/database/transaction.interface";
import { UserCreationData, UserUpdateData } from "src/account/account.interface";
import { IUserRepository } from "src/account/user.repository";


@Injectable()
export class PrismaUserRepository extends IUserRepository {
    constructor(private prismaService: PrismaService) { super() }
    
    async create(user: UserCreationData, tx?: ITransactionContext) {

        const prismaClient = this.prismaService.getClient(tx);

        const created = await prismaClient.user.create({
            data: user
        });

        return created;
    }

    async update(user: Partial<UserUpdateData>, tx?: ITransactionContext) {

        const prismaClient = this.prismaService.getClient(tx);

        const updated = await prismaClient.user.update({
                where: { id: user.id },
                data: {
                    email: user.email,
                    password: user.password, 
                    isActive: user.isActive,
                    isArchived: user.isArchived
                },
            });

        return updated;
    }

    async findUserByEmail(email: string, currentUser: AuthenticatedUserPayload, tx?: ITransactionContext) {

        const prismaClient = this.prismaService.getClient(tx);

        const user = await prismaClient.user.findFirst({
            where: {
                email
            },
        });
        
        return user;
    }

    async findUserById(id: string, organizationId: string, tx?: ITransactionContext) {
        
        const prismaClient = this.prismaService.getClient(tx);;

        const user = await prismaClient.user.findFirst({
            where: {
                id: id
            },
        });
        
        return user;
    }

    async existsByEmail(email: string, tx?: ITransactionContext): Promise<boolean> {

        const prismaClient = this.prismaService.getClient(tx);

        const count = await prismaClient.user.count({
            where: { email },
        });
        return count > 0;
    }
}