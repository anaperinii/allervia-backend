import { PrismaClient } from "@prisma/client/extension";
import { DoseFactory } from "./dose.factory";
import { ImmunotherapyFactory } from "./immunotherapy.factory";
import { InternalUserInviteFactory } from "./internal-user-invite.factory";
import { MembershipFactory } from "./membership.factory";
import { OrganizationFactory } from "./organization.factory";
import { PatientFactory } from "./patient.factory";
import { ProfessionalFactory } from "./professional.factory";
import { UserRoleFactory } from "./user-role.factory";
import { UserFactory } from "./user.factory";

export class TestFactories {
    public readonly users: UserFactory;
    public readonly professionals: ProfessionalFactory;
    public readonly userRoles: UserRoleFactory;
    public readonly patients: PatientFactory;
    public readonly organizations: OrganizationFactory;
    public readonly memberships: MembershipFactory;
    public readonly internalUserInvite: InternalUserInviteFactory;
    public readonly immunotherapies: ImmunotherapyFactory;
    public readonly doses: DoseFactory;

    constructor(prisma: PrismaClient) {
        this.users = new UserFactory(prisma);
        this.professionals = new ProfessionalFactory(prisma);
        this.userRoles = new UserRoleFactory(prisma);
        this.patients = new PatientFactory(prisma);
        this.organizations = new OrganizationFactory(prisma);
        this.memberships = new MembershipFactory(prisma);
        this.internalUserInvite = new InternalUserInviteFactory(prisma);
        this.immunotherapies = new ImmunotherapyFactory(prisma);
        this.doses = new DoseFactory(prisma);
    }
}