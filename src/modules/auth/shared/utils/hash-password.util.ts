import * as bcrypt from 'bcrypt';
import { PASSWORD_HASH_ROUNDS } from '../constants/password.constant';

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, PASSWORD_HASH_ROUNDS);
}
