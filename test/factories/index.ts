import { PrismaClient } from "@prisma/client/extension";
import { DoseFactory } from "./dose.factory";
import { ImmunotherapyFactory } from "./immunotherapy.factory";
import { InternalUserInviteFactory } from "./internal-user-invite.factory";
import { OrganizationFactory } from "./organization.factory";
import { PatientFactory } from "./patient.factory";
import { UserFactory } from "./user.factory";

export class TestFactories {
    public readonly users: UserFactory;
    public readonly patients: PatientFactory;
    public readonly organizations: OrganizationFactory;
    public readonly internalUserInvite: InternalUserInviteFactory;
    public readonly immunotherapies: ImmunotherapyFactory;
    public readonly doses: DoseFactory;

    constructor(prisma: PrismaClient) {
        this.users = new UserFactory(prisma);
        this.patients = new PatientFactory(prisma);
        this.organizations = new OrganizationFactory(prisma);
        this.internalUserInvite = new InternalUserInviteFactory(prisma);
        this.immunotherapies = new ImmunotherapyFactory(prisma);
        this.doses = new DoseFactory(prisma);
    }
}
