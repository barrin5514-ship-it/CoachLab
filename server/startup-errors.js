// Translates known startup failures into useful messages without printing credentials.
export class StartupCheckError extends Error {}

const prismaReasons = {
  P1000: 'Database authentication failed; check the credentials in DATABASE_URL and DIRECT_URL.',
  P1001: 'Database server could not be reached; check endpoint availability and network access.',
  P1002: 'Database connection timed out.',
  P1003: 'The configured database does not exist.',
  P1010: 'The configured database role lacks access.',
  P1011: 'Database TLS negotiation failed.',
  P1012: 'Prisma configuration or schema validation failed.',
  P2021: 'A required table is missing after migrations.',
  P2022: 'A required column is missing after migrations.',
  P3005: 'The database is not empty and has no compatible migration baseline; do not reset it.',
  P3009: 'A previous migration failed; inspect migration history before retrying.',
  P3018: 'A migration SQL step failed; inspect migration history before retrying.',
};

// Shows only recognized safe Prisma error descriptions, never raw provider output.
export function prismaFailureReason(code) {
  return Object.hasOwn(prismaReasons, code) ? `${code}: ${prismaReasons[code]}` : 'No recognized safe error code; raw provider output was withheld.';
}

// Names the failed startup stage without leaking connection details.
export function startupFailure(stage, error) {
  const reason = error instanceof StartupCheckError ? error.message : prismaFailureReason(error?.code);
  return `Production startup stopped at ${stage}. ${reason} No development fallback was attempted.`;
}
