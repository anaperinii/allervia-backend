export interface RegisterUser {
    id: string;
    fullName: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
    specialty: string | null;
    phoneNumber: string | null;
};
