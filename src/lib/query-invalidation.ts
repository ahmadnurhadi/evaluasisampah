import type { QueryClient, QueryKey } from "@tanstack/react-query";

async function invalidateFamilies(queryClient: QueryClient, families: readonly QueryKey[]) {
  await Promise.all(families.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

const WASTE_FAMILIES = [
  ["dashboard"],
  ["report"],
  ["waste-batches"],
  ["collectable-batches"],
  ["recent-collections"],
  ["sortable-batches"],
  ["outcome-batches"],
  ["outcome-records"],
  ["recent-waste-records"],
] satisfies readonly QueryKey[];

const AUDIT_FAMILIES = [
  ["environmental-audits"],
  ["audit-findings"],
  ["finding-audits"],
  ["dashboard"],
  ["report"],
] satisfies readonly QueryKey[];

const ACTIVITY_FAMILIES = [
  ["environmental-activities"],
  ["dashboard"],
  ["report"],
] satisfies readonly QueryKey[];

const MASTER_DATA_FAMILIES = [
  ["master-records"],
  ["master-school-options"],
  ["dashboard-masters"],
  ["waste-input-locations"],
  ["waste-input-sources"],
  ["waste-input-types"],
  ["sorting-waste-types"],
  ["activity-schools"],
  ["activity-locations"],
  ["audit-schools"],
  ["audit-locations"],
  ["audit-indicators"],
  ["finding-schools"],
  ["finding-locations"],
  ["finding-audits"],
  ["qr-schools"],
  ["qr-locations"],
  ["outcome-schools"],
  ["outcome-batches"],
  ["outcome-partners"],
  ["outcome-recyclable-types"],
  ["report-schools"],
  ["user-admin-schools"],
  ["managed-users"],
  ["report"],
] satisfies readonly QueryKey[];

const USER_FAMILIES = [["managed-users"], ["auth-profile"]] satisfies readonly QueryKey[];

export function invalidateWasteQueries(queryClient: QueryClient) {
  return invalidateFamilies(queryClient, WASTE_FAMILIES);
}

export function invalidateAuditQueries(queryClient: QueryClient) {
  return invalidateFamilies(queryClient, AUDIT_FAMILIES);
}

export function invalidateActivityQueries(queryClient: QueryClient) {
  return invalidateFamilies(queryClient, ACTIVITY_FAMILIES);
}

export function invalidateMasterDataQueries(queryClient: QueryClient) {
  return invalidateFamilies(queryClient, MASTER_DATA_FAMILIES);
}

export function invalidateUserQueries(queryClient: QueryClient) {
  return invalidateFamilies(queryClient, USER_FAMILIES);
}