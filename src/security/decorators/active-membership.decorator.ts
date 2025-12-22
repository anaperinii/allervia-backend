import { BadRequestException, createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUserPayload, MembershipPayload } from '../types/auth.types';
import { Request } from 'express'; 

export const ActiveMembership = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): MembershipPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUserPayload;

    if(!user) {
      throw new BadRequestException('Usuário não autenticado')
    }
    
    if(user.type !== 'PATIENT' && user.type !== 'SYSTEM_ADMIN') {
      throw new ForbiddenException('Tipo de usuário não compatível com filtro de memberships');
    }

    return request.activeMembership as MembershipPayload;
  },
);
