import { z } from "zod";

import { env, requireGooglePlacesApiKey } from "../config/env.js";
import type { LeadCandidate } from "../domain/lead.js";

const searchResponseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string().min(1),
        displayName: z.object({
          text: z.string().min(1)
        })
      })
    )
    .default([]),
  nextPageToken: z.string().optional()
});

const detailsResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.object({
    text: z.string().min(1)
  }),
  nationalPhoneNumber: z.string().trim().optional(),
  internationalPhoneNumber: z.string().trim().optional(),
  websiteUri: z.string().url().optional(),
  googleMapsUri: z.string().url().optional(),
  editorialSummary: z.object({ text: z.string() }).optional(),
  primaryTypeDisplayName: z.object({ text: z.string() }).optional()
});

export type SearchLeadsInput = {
  query: string;
  regionCode?: string;
  maxResults: number;
};

export class GooglePlacesClient {
  async searchLeads(input: SearchLeadsInput): Promise<LeadCandidate[]> {
    const apiKey = requireGooglePlacesApiKey();
    const allPlaces = [];
    let pageToken: string | undefined = undefined;
    let keepPaginating = true;

    while (keepPaginating && allPlaces.length < input.maxResults) {
      const searchResults = await this.searchText(input, pageToken);
      allPlaces.push(...searchResults.places);

      pageToken = searchResults.nextPageToken;

      if (!pageToken || allPlaces.length >= input.maxResults) {
        keepPaginating = false;
      } else {
        // Delay to avoid rapid-fire paging rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Limit to maxResults
    const placesToFetch = allPlaces.slice(0, input.maxResults);
    const detailedLeads: (LeadCandidate | null)[] = [];

    // Chunk size 20 to avoid 429 Too Many Requests
    const chunkSize = 20;
    for (let i = 0; i < placesToFetch.length; i += chunkSize) {
      const chunk = placesToFetch.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (place) => this.fetchLead(place.id, apiKey))
      );
      detailedLeads.push(...chunkResults);
    }

    return detailedLeads.filter((lead): lead is LeadCandidate => lead !== null);
  }

  private async searchText(input: SearchLeadsInput, pageToken?: string) {
    const apiKey = requireGooglePlacesApiKey();
    const response = await fetch(`${env.GOOGLE_PLACES_BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,nextPageToken"
      },
      body: JSON.stringify({
        textQuery: input.query,
        ...(input.maxResults <= 20 ? { maxResultCount: input.maxResults } : { maxResultCount: 20 }),
        ...(input.regionCode ? { regionCode: input.regionCode } : {}),
        ...(pageToken ? { pageToken } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`Google Places search failed with status ${response.status}`);
    }

    return searchResponseSchema.parse(await response.json());
  }

  private async fetchLead(placeId: string, apiKey: string): Promise<LeadCandidate | null> {
    const response = await fetch(`${env.GOOGLE_PLACES_BASE_URL}/places/${placeId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,editorialSummary,primaryTypeDisplayName"
      }
    });

    if (!response.ok) {
      throw new Error(`Google Places details failed with status ${response.status}`);
    }

    const place = detailsResponseSchema.parse(await response.json());
    const phoneNumber = place.nationalPhoneNumber || place.internationalPhoneNumber;

    if (!phoneNumber) {
      return null;
    }

    const lead: LeadCandidate = {
      placeId: place.id,
      companyName: place.displayName.text,
      phoneNumber
    };

    if (place.websiteUri) {
      lead.websiteUri = place.websiteUri;
    }
    
    if (place.googleMapsUri) {
      lead.googleMapsUri = place.googleMapsUri;
    }

    if (place.editorialSummary?.text) {
      lead.editorialSummary = place.editorialSummary.text;
    }

    if (place.primaryTypeDisplayName?.text) {
      lead.businessType = place.primaryTypeDisplayName.text;
    }

    return lead;
  }
}
