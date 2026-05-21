export const leadStatuses = ["pending", "approved", "rejected"] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export type LeadCandidate = {
  placeId: string;
  companyName: string;
  phoneNumber: string;
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: string;
  businessType?: string;
};

export type LeadRecord = LeadCandidate & {
  id: string;
  status: LeadStatus;
  source: "google_places" | "manual";
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  
  // Persistência de Landing Page
  siteUrl?: string | undefined;
  githubUrl?: string | undefined;
  stitchProjectId?: string | undefined;
  stitchSessionId?: string | undefined;
};

export function createLeadRecord(candidate: LeadCandidate, now = new Date(), source: "google_places" | "manual" = "google_places"): LeadRecord {
  const timestamp = now.toISOString();

  const record: LeadRecord = {
    id: candidate.placeId,
    placeId: candidate.placeId,
    companyName: candidate.companyName,
    phoneNumber: candidate.phoneNumber,
    status: "pending",
    source: source,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSeenAt: timestamp
  };

  if (candidate.websiteUri) record.websiteUri = candidate.websiteUri;
  if (candidate.googleMapsUri) record.googleMapsUri = candidate.googleMapsUri;
  if (candidate.editorialSummary) record.editorialSummary = candidate.editorialSummary;
  if (candidate.businessType) record.businessType = candidate.businessType;

  return record;
}
