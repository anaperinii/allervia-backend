import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticated_only';

export const AuthenticatedOnly = () =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
