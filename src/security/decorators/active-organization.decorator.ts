import { BadRequestException, createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Request } from 'express'; 
import { AuthenticatedUserPayload } from "../types/auth.types";

export const ActiveOrganization = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<Request>();
        const user = request.user as AuthenticatedUserPayload;

        if(!user) {
            throw new BadRequestException('Usuário não autenticado');
        }

        if(!user.activeOrgId) {
            throw new ForbiddenException('Organização ativa não definida');
        }
        
        return user.activeOrgId;
        
    }
)