import { BadRequestException, Injectable } from "@nestjs/common";
import { AdminRegisterStrategy } from "./admin-regiter.strategy";
import { ProfessionalRegisterStrategy } from "./professional-register.strategy";
import { Role } from "@prisma/client";
import { RegisterStrategy } from "./register.strategy";

@Injectable()
export class RegisterStrategyFactory{
    constructor(
        private adminRegisterStrategy: AdminRegisterStrategy,
        private professionalRegisterStrategy: ProfessionalRegisterStrategy
    ) {};

    getStrategy(roleType: Role): RegisterStrategy {
        if(roleType === 'ADMIN') {
            return this.adminRegisterStrategy;
        }

        if(roleType === 'PHYSICIAN' || 'NURSE' || 'NURSE_TECHNICIAN') {
            return this.professionalRegisterStrategy;
        }

        throw new BadRequestException('Tipo de usuário não compatível para registrar através de invites');
    }
}