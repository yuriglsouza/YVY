import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const issuer = "https://token.actions.githubusercontent.com";
const audience = "syaz-satellite-sync";
const repository = "yuriglsouza/YVY";
const repositoryId = "1151505523";
const workflowRef = `${repository}/.github/workflows/satellite-sync.yml@refs/heads/main`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));

export function isAuthorizedSatelliteWorkflow(claims: JWTPayload): boolean {
  return claims.repository === repository &&
    claims.repository_id === repositoryId &&
    claims.ref === "refs/heads/main" &&
    claims.sub === `repo:${repository}:ref:refs/heads/main` &&
    claims.workflow_ref === workflowRef &&
    (claims.event_name === "schedule" || claims.event_name === "workflow_dispatch");
}

export async function verifySatelliteWorkflowAuthorization(header: string | undefined): Promise<boolean> {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "repository", "repository_id", "ref", "workflow_ref", "event_name"],
      maxTokenAge: "5m",
    });
    return isAuthorizedSatelliteWorkflow(payload);
  } catch {
    return false;
  }
}
