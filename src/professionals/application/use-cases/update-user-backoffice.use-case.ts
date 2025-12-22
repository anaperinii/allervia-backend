import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { UpdateUserBackofficeDto } from "../../../account/application/dtos/update-user-backoffice.dto";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { UserNotFoundException } from "src/account/domain/exceptions/user-not-found.exception";
import { UserResponseDto } from "../../../account/application/dtos/user-response.dto";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { PrismaService } from "src/prisma/prisma.service";
import { UserProfessionalResponseDto } from "../../../account/application/dtos/user-professional-response.dto";


@Injectable()
export class UpdateUserBackofficeUseCase {
    constructor(
        private userRepository: IUserRepository,
        private professionalRepository: IProfessionalRepository,
        private prisma: PrismaService
    ) {}

    async execute(
        id: string,
        dto: UpdateUserBackofficeDto,
        currentUser: AuthenticatedUserPayload,
    ): Promise<UserProfessionalResponseDto> {

        return await this.prisma.$transaction(async (tx) => {

            const user = await this.userRepository.findUserById(id, currentUser.activeOrgId, tx);

            if(!user) {
                throw new UserNotFoundException(id);
            }

            const professional = await this.professionalRepository.findProfessionalByUserId(user.id);

            if(!professional) {
                throw new NotFoundException('Não há registro de um usuário do tipo Profissional com este ID');
            }

            if (dto.fullName) {
                user.updateProfile(dto.fullName);
            }

            if(dto.phoneNumber || dto.specialty) {
                professional.update(dto.specialty, dto.phoneNumber);   
            }

            const updatedUserProfessional = await this.professionalRepository.update(professional, tx);

            const updatedUser = await this.userRepository.update(user, tx);

            const responseData = {
                ...updatedUser,
                professional: {
                    ...updatedUserProfessional
                }
            };

            return responseData;
        });
    }
}