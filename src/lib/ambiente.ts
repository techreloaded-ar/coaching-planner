import "server-only";

/** Solo il collaudo stabile: le altre Preview e la produzione non hanno il banner. */
export function ambientePreproduzione(): boolean {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "pre-prod"
  );
}
