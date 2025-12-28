import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUserPayload } from '../types/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';
import { OrganizationContextFactory } from '../factories/organization-context.factory';
import { IUserRepository } from 'src/account/domain/interfaces/user.repository.interface';

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userRepository: IUserRepository,
    private organizationContextFactory: OrganizationContextFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUserPayload;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    if (!user) {
      throw new ForbiddenException('Usuário não registrado');
    }

    // Usa a factory para obter a estratégia correta baseada no tipo de usuário
    const strategy = this.organizationContextFactory.getStrategy(user.type);
    await strategy.resolveContext(user, this.userRepository, request);

    return true;
  }
}
