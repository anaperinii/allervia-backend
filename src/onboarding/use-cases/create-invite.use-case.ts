import { ConflictException, Injectable } from "@nestjs/common";
import { InviteStrategyContext } from "../strategies/invites/invite-strategy.context";
import { CreateInviteDto } from "../dtos/create-invite.dto";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";
import { ulid } from "ulid";
import { ValidateUserEmailUseCase } from "src/account/use-cases/users/validate-user-email.use-case";
import { FindUserByIdUseCase } from "src/account/use-cases/users/find-user-by-id.use-case";
import { UserInvite } from "../domain/entities/user-invite.entity";
import { InviteResponseDto } from "../dtos/invite-response.dto";
import { IUserInviteRepository } from "../domain/interfaces/user-invite.repository.interface";
import { INVITE_MESSAGES } from "../invite.messages";
import { FindActiveInviteUseCase } from "./find-active-invite.use-case";


@Injectable()
export class CreateInviteUseCase {
  constructor(
    private validationContext: InviteStrategyContext,
    private findUserById: FindUserByIdUseCase,
    private validateUserEmail: ValidateUserEmailUseCase,
    private inviteRepository: IUserInviteRepository,
    private findActiveInviteUseCase: FindActiveInviteUseCase
  ) {}

  async execute(
    dto: CreateInviteDto,
    currentUser: AuthenticatedUserPayload
  ): Promise<InviteResponseDto> {

    const organizationId = await this.validationContext.validateAndGetOrganizationId(
      dto,
      currentUser
    );

    const user = await this.validateUserEmail.execute(dto.email, currentUser);

    if (user && user.isActive) {
      throw new ConflictException(INVITE_MESSAGES.emailAlreadyActive);
    }

    const existingInvite = await this.findActiveInviteUseCase.execute(
      dto.email,
      organizationId
    );

    if (existingInvite) {
      throw new ConflictException(
        `Já existe um convite ativo para ${dto.email} nesta organização`
      );
    }

    const token = ulid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); 

    // 5. TODO: Disparar evento para envio de email
    // this.eventEmitter.emit('invite.created', { invite, inviteLink });

    const createdByUser = await this.findUserById.execute(currentUser.id, currentUser);

    const invite = UserInvite.createNew({
      email: dto.email,
      fullName: dto.fullName,
      role: dto.userRole,
      organizationId,
      createdById: createdByUser.id,
      token,
      expiresAt,
    });

    const created = await this.inviteRepository.create(invite);

    const inviteData = {
      ...created,
      createdById: createdByUser.id,
      createdByEmail: createdByUser.email,
    }

    return inviteData;
   }
}