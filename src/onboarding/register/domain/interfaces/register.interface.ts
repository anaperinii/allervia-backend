interface RegisterUser {
    id: string;
    fullName: string;
    email: string;
};

interface RegisterProfessional {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    specialty: string;
    userId: string;
};

export interface RegisterResult {
    user: RegisterUser;
    professional?: RegisterProfessional;
};
