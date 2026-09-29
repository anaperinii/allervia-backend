import { SetMetadata } from '@nestjs/common';

export const PREAUTH_CSRF_KEY = 'preauth-csrf';
export const PreAuthCsrf = () => SetMetadata(PREAUTH_CSRF_KEY, true);
