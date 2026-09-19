export type EnvironmentalRiskStatus = "not_assessed" | "review_required";

export function getEnvironmentalRiskStatus(
  isDeforested: boolean | null | undefined,
): EnvironmentalRiskStatus {
  return isDeforested === true ? "review_required" : "not_assessed";
}
