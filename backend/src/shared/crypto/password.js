import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1
};

// Pre-computed dummy hash to verify for non-existent users to prevent timing attacks
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$u3S3j6vYk0F1t9F8e5D7aw$sQzYg4T5o1+dKk+q6K8w3hF5rL9k1W2x4y6z8a0b1c2';

export async function hashPassword(plainPassword) {
  return await argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hash, plainPassword) {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    return false;
  }
}

export async function verifyDummyPassword(plainPassword) {
  try {
    await argon2.verify(DUMMY_HASH, plainPassword);
  } catch {
    // ignore
  }
  return false;
}
