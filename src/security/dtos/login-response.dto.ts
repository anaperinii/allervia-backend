export class LoginResponseDto {
  access_token: string;
  user: {
    type: string;
    organizationId?: string;
  };
}
