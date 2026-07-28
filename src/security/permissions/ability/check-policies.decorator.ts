import { SetMetadata } from '@nestjs/common';
import { AppAction, AppSubjects } from './ability.types';

export interface RequiredRule {
  action: AppAction;
  subject: AppSubjects;
}

export const CHECK_POLICIES_KEY = 'check_policies';

export const CheckPolicies = (...rules: RequiredRule[]) =>
  SetMetadata(CHECK_POLICIES_KEY, rules);
