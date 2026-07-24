export class LoginResponseDto {
  access_token: string;
  user: {
    type: string;
    activeOrgId?: string;
  };
}
