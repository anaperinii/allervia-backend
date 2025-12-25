
import {
  AuthenticatedUserPayload,
  MembershipPayload,
} from 'src/security/types/auth.types';

/**
 * Este ficheiro usa o "declaration merging" do TypeScript para adicionar as nossas
 * propriedades customizadas (`user` e `activeMembership`) à interface Request
 * global do Express.
 */
declare global {
  namespace Express {
    interface Request {
      // Propriedade opcional ao Request
      activeMembership?: MembershipPayload;
    }
  }
}