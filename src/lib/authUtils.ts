import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * ฟังก์ชันเข้ารหัสรหัสผ่านก่อนบันทึกลงฐานข้อมูล
 */
export function hashPassword(plainPassword: string): string {
  if (!plainPassword) return '';
  const salt = bcrypt.genSaltSync(SALT_ROUNDS);
  return bcrypt.hashSync(plainPassword.trim(), salt);
}

/**
 * ฟังก์ชันตรวจสอบรหัสผ่านตอน Login หรือเซ็นรับงาน
 * รองรับทั้ง bcrypt hash ($2a$, $2b$, $2y$) และ plain text เดิม
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!plainPassword || !storedHash) return false;
  
  const trimmedPass = plainPassword.trim();
  const trimmedHash = storedHash.trim();

  // กรณีเป็น bcrypt Hash
  if (trimmedHash.startsWith('$2a$') || trimmedHash.startsWith('$2b$') || trimmedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(trimmedPass, trimmedHash);
    } catch (e) {
      console.error('Bcrypt comparison error:', e);
      return false;
    }
  }

  // กรณีเป็นรหัสผ่านแบบข้อความธรรมดา (ข้อมูลเดิม)
  return trimmedPass === trimmedHash;
}
