import { createLeadRecord, type LeadCandidate, type LeadRecord, type LeadStatus } from "../domain/lead.js";
import { supabase } from "../config/supabase.js";

export class LeadQueueRepository {
  async list(userId: string, status?: LeadStatus): Promise<LeadRecord[]> {
    let query = supabase.from("leads").select("*").eq("user_id", userId).order("updated_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching leads from Supabase:", error);
      return [];
    }

    return data.map(mapRowToLeadRecord);
  }

  async saveMany(userId: string, candidates: LeadCandidate[]): Promise<LeadRecord[]> {
    const records = candidates.map(candidate => {
      const record = createLeadRecord(candidate);
      const row = mapLeadRecordToRow(record);
      row.user_id = userId;
      return row;
    });

    if (records.length === 0) return [];

    // UPSERT directly based on place_id, user_id (unique constraint)
    const { data, error } = await supabase
      .from("leads")
      .upsert(records, { onConflict: "place_id, user_id" })
      .select();

    if (error) {
      console.error("Error upserting leads to Supabase:", error);
      return [];
    }

    return (data || []).map(mapRowToLeadRecord);
  }

  async updateStatus(userId: string, id: string, status: LeadStatus): Promise<LeadRecord | null> {
    const { data, error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating lead status ${id}:`, error);
      return null;
    }

    return mapRowToLeadRecord(data);
  }

  async saveSiteData(userId: string, id: string, siteData: { siteUrl?: string | undefined; githubUrl?: string | undefined; stitchProjectId?: string | undefined; stitchSessionId?: string | undefined }): Promise<LeadRecord | null> {
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    
    // Explicitly handle undefined to update to NULL in DB or keep existing
    // But since the signature allows undefined to reset fields, we should pass null for Supabase
    updatePayload.site_url = siteData.siteUrl ?? null;
    updatePayload.github_url = siteData.githubUrl ?? null;
    updatePayload.stitch_project_id = siteData.stitchProjectId ?? null;
    updatePayload.stitch_session_id = siteData.stitchSessionId ?? null;

    const { data, error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating site data for ${id}:`, error);
      return null;
    }

    return mapRowToLeadRecord(data);
  }

  async clear(userId: string): Promise<void> {
    // In production we usually don't want to easily wipe the DB.
    // For now we will allow it via delete where id != null
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error clearing leads from Supabase:", error);
    }
  }
}

// Helper Mappers for snake_case (DB) to camelCase (App)
function mapRowToLeadRecord(row: any): LeadRecord {
  return {
    id: row.id,
    placeId: row.place_id,
    companyName: row.company_name,
    phoneNumber: row.phone_number,
    websiteUri: row.website_uri || undefined,
    googleMapsUri: row.google_maps_uri || undefined,
    editorialSummary: row.editorial_summary || undefined,
    businessType: row.business_type || undefined,
    status: row.status as LeadStatus,
    source: row.source,
    siteUrl: row.site_url || undefined,
    githubUrl: row.github_url || undefined,
    stitchProjectId: row.stitch_project_id || undefined,
    stitchSessionId: row.stitch_session_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at
  };
}

function mapLeadRecordToRow(record: LeadRecord): any {
  return {
    id: record.id,
    place_id: record.placeId,
    company_name: record.companyName,
    phone_number: record.phoneNumber,
    website_uri: record.websiteUri || null,
    google_maps_uri: record.googleMapsUri || null,
    editorial_summary: record.editorialSummary || null,
    business_type: record.businessType || null,
    status: record.status,
    source: record.source,
    site_url: record.siteUrl || null,
    github_url: record.githubUrl || null,
    stitch_project_id: record.stitchProjectId || null,
    stitch_session_id: record.stitchSessionId || null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    last_seen_at: record.lastSeenAt
  };
}
