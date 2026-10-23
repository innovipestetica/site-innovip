// Gerado por `npm run db:types` (supabase gen types). Não editar à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"revision": number,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["editorial_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"revision"?: number,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["editorial_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"revision"?: number,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["editorial_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"concerns": {
                  Row: {
                    "area": string | null,"created_at": string,"description": string | null,"id": string,"name": string,"revision": number,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["editorial_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"revision"?: number,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["editorial_status"],"updated_at"?: string
                  }
                  Update: {
                    "area"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"revision"?: number,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["editorial_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"content_entries": {
                  Row: {
                    "created_at": string,"first_published_at": string | null,"id": string,"latest_revision": number,"lifecycle_status": Database["public"]['Enums']["lifecycle_status"],"published_at": string | null,"published_version_id": string | null,"slug": string,"sort_order": number,"type": Database["public"]['Enums']["content_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"first_published_at"?: string | null,"id"?: string,"latest_revision"?: number,"lifecycle_status"?: Database["public"]['Enums']["lifecycle_status"],"published_at"?: string | null,"published_version_id"?: string | null,"slug": string,"sort_order"?: number,"type": Database["public"]['Enums']["content_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"first_published_at"?: string | null,"id"?: string,"latest_revision"?: number,"lifecycle_status"?: Database["public"]['Enums']["lifecycle_status"],"published_at"?: string | null,"published_version_id"?: string | null,"slug"?: string,"sort_order"?: number,"type"?: Database["public"]['Enums']["content_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_entries_published_version_fk"
      columns: ["published_version_id","id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id","entry_id"]
    }
                  ]
                },"content_versions": {
                  Row: {
                    "blocks": NonNullable<Json>,"created_at": string,"created_by": string | null,"data": NonNullable<Json>,"entry_id": string,"id": string,"revision": number,"schema_version": number,"seo": NonNullable<Json>,"summary": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"data"?: NonNullable<Json>,"entry_id": string,"id"?: string,"revision": number,"schema_version": number,"seo"?: NonNullable<Json>,"summary"?: string | null,"title": string
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"data"?: NonNullable<Json>,"entry_id"?: string,"id"?: string,"revision"?: number,"schema_version"?: number,"seo"?: NonNullable<Json>,"summary"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_versions_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_versions_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "content_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"landing_details": {
                  Row: {
                    "campaign_key": string | null,"promotion_entry_id": string | null,"reduced_navigation": boolean,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_key"?: string | null,"promotion_entry_id"?: string | null,"reduced_navigation"?: boolean,"version_id": string
                  }
                  Update: {
                    "campaign_key"?: string | null,"promotion_entry_id"?: string | null,"reduced_navigation"?: boolean,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "landing_details_promotion_entry_id_fkey"
      columns: ["promotion_entry_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "landing_details_promotion_entry_id_fkey"
      columns: ["promotion_entry_id"]
isOneToOne: false
      referencedRelation: "content_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "landing_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "landing_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "alt": string | null,"created_at": string,"height": number | null,"id": string,"mime": string,"private_original_path": string,"private_variants": NonNullable<Json>,"public_variants": NonNullable<Json>,"revision": number,"sha256": string | null,"size_bytes": number,"status": Database["public"]['Enums']["media_status"],"updated_at": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"mime": string,"private_original_path": string,"private_variants"?: NonNullable<Json>,"public_variants"?: NonNullable<Json>,"revision"?: number,"sha256"?: string | null,"size_bytes": number,"status"?: Database["public"]['Enums']["media_status"],"updated_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "alt"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"mime"?: string,"private_original_path"?: string,"private_variants"?: NonNullable<Json>,"public_variants"?: NonNullable<Json>,"revision"?: number,"sha256"?: string | null,"size_bytes"?: number,"status"?: Database["public"]['Enums']["media_status"],"updated_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"media_permissions": {
                  Row: {
                    "created_at": string,"description": string,"evidence_path": string | null,"expires_on": string | null,"granted_on": string | null,"id": string,"kind": string,"media_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"evidence_path"?: string | null,"expires_on"?: string | null,"granted_on"?: string | null,"id"?: string,"kind": string,"media_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"evidence_path"?: string | null,"expires_on"?: string | null,"granted_on"?: string | null,"id"?: string,"kind"?: string,"media_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_permissions_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"promotion_details": {
                  Row: {
                    "ends_at": string | null,"original_price_cents": number | null,"price_cents": number | null,"starts_at": string | null,"terms": string | null,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at"?: string | null,"original_price_cents"?: number | null,"price_cents"?: number | null,"starts_at"?: string | null,"terms"?: string | null,"version_id": string
                  }
                  Update: {
                    "ends_at"?: string | null,"original_price_cents"?: number | null,"price_cents"?: number | null,"starts_at"?: string | null,"terms"?: string | null,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotion_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "promotion_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"promotion_treatments": {
                  Row: {
                    "treatment_entry_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "treatment_entry_id": string,"version_id": string
                  }
                  Update: {
                    "treatment_entry_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotion_treatments_treatment_entry_id_fkey"
      columns: ["treatment_entry_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_treatments_treatment_entry_id_fkey"
      columns: ["treatment_entry_id"]
isOneToOne: false
      referencedRelation: "content_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotion_treatments_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "promotion_treatments_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"redirect_events": {
                  Row: {
                    "browser": string | null,"browser_language": string | null,"city": string | null,"clicked_page": string | null,"country_code": string | null,"created_at": string,"device_type": string | null,"id": number,"is_returning": boolean | null,"operating_system": string | null,"referrer_host": string | null,"region_code": string | null,"source_detail": string | null,"source_path": string,"target_url": string,"timezone": string | null,"utm_campaign": string | null,"utm_content": string | null,"utm_medium": string | null,"utm_source": string | null,"utm_term": string | null,"visitor_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"browser_language"?: string | null,"city"?: string | null,"clicked_page"?: string | null,"country_code"?: string | null,"created_at"?: string,"device_type"?: string | null,"id"?: never,"is_returning"?: boolean | null,"operating_system"?: string | null,"referrer_host"?: string | null,"region_code"?: string | null,"source_detail"?: string | null,"source_path"?: string,"target_url": string,"timezone"?: string | null,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_key"?: string | null
                  }
                  Update: {
                    "browser"?: string | null,"browser_language"?: string | null,"city"?: string | null,"clicked_page"?: string | null,"country_code"?: string | null,"created_at"?: string,"device_type"?: string | null,"id"?: never,"is_returning"?: boolean | null,"operating_system"?: string | null,"referrer_host"?: string | null,"region_code"?: string | null,"source_detail"?: string | null,"source_path"?: string,"target_url"?: string,"timezone"?: string | null,"utm_campaign"?: string | null,"utm_content"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"utm_term"?: string | null,"visitor_key"?: string | null
                  }
                  Relationships: []
                },"redirects": {
                  Row: {
                    "created_at": string,"id": string,"preview_description": string | null,"preview_media_id": string | null,"preview_site_name": string | null,"preview_title": string | null,"source_path": string,"status_code": number,"target_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"preview_description"?: string | null,"preview_media_id"?: string | null,"preview_site_name"?: string | null,"preview_title"?: string | null,"source_path": string,"status_code"?: number,"target_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"preview_description"?: string | null,"preview_media_id"?: string | null,"preview_site_name"?: string | null,"preview_title"?: string | null,"source_path"?: string,"status_code"?: number,"target_path"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_settings_public": {
                  Row: {
                    "data": NonNullable<Json>,"id": number,"revision": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data"?: NonNullable<Json>,"id"?: number,"revision"?: number,"updated_at"?: string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"id"?: number,"revision"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"treatment_categories": {
                  Row: {
                    "category_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"version_id": string
                  }
                  Update: {
                    "category_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treatment_categories_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "treatment_categories_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"treatment_concerns": {
                  Row: {
                    "concern_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "concern_id": string,"version_id": string
                  }
                  Update: {
                    "concern_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_concerns_concern_id_fkey"
      columns: ["concern_id"]
isOneToOne: false
      referencedRelation: "concerns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treatment_concerns_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "treatment_concerns_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"treatment_details": {
                  Row: {
                    "clinical_reviewed_on": string | null,"clinical_reviewer": string | null,"requires_evaluation": boolean,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinical_reviewed_on"?: string | null,"clinical_reviewer"?: string | null,"requires_evaluation"?: boolean,"version_id": string
                  }
                  Update: {
                    "clinical_reviewed_on"?: string | null,"clinical_reviewer"?: string | null,"requires_evaluation"?: boolean,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treatment_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "treatment_details_version_id_fkey"
      columns: ["version_id"]
isOneToOne: true
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"version_entry_refs": {
                  Row: {
                    "target_entry_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "target_entry_id": string,"version_id": string
                  }
                  Update: {
                    "target_entry_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "version_entry_refs_target_entry_id_fkey"
      columns: ["target_entry_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "version_entry_refs_target_entry_id_fkey"
      columns: ["target_entry_id"]
isOneToOne: false
      referencedRelation: "content_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "version_entry_refs_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "version_entry_refs_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"version_media_refs": {
                  Row: {
                    "media_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "media_id": string,"version_id": string
                  }
                  Update: {
                    "media_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "version_media_refs_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "version_media_refs_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "cms_entry_list"
      referencedColumns: ["latest_version_id"]
    },{
      foreignKeyName: "version_media_refs_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "cms_entry_list": {
                  Row: {
                    "created_at": string | null,"first_published_at": string | null,"id": string | null,"latest_revision": number | null,"latest_saved_at": string | null,"latest_version_id": string | null,"lifecycle_status": Database["public"]['Enums']["lifecycle_status"] | null,"published_at": string | null,"published_revision": number | null,"published_version_id": string | null,"slug": string | null,"sort_order": number | null,"summary": string | null,"title": string | null,"type": Database["public"]['Enums']["content_type"] | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "content_entries_published_version_fk"
      columns: ["published_version_id","id"]
isOneToOne: false
      referencedRelation: "content_versions"
      referencedColumns: ["id","entry_id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_session_status":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"cms_archive":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"cms_change_slug":
{ Args: { "p_entry_id": string,"p_new_slug": string }; Returns: undefined
                           },
"cms_check_publish":
{ Args: { "p_version_id": string }; Returns: (string)[]
                           },
"cms_create_entry":
{ Args: { "p_payload": Json,"p_slug": string,"p_type": Database["public"]['Enums']["content_type"] }; Returns: {
              "entry_id": string,"revision": number,"version_id": string
            }[]
                           },
"cms_duplicate_entry":
{ Args: { "p_entry_id": string,"p_new_slug": string }; Returns: {
              "entry_id": string,"revision": number,"version_id": string
            }[]
                           },
"cms_publish":
{ Args: { "p_entry_id": string,"p_version_id": string }; Returns: undefined
                           },
"cms_restore_version":
{ Args: { "p_base_revision": number,"p_entry_id": string,"p_version_id": string }; Returns: {
              "revision": number,"version_id": string
            }[]
                           },
"cms_save_settings":
{ Args: { "p_base_revision": number,"p_data": Json }; Returns: number
                           },
"cms_save_version":
{ Args: { "p_base_revision": number,"p_entry_id": string,"p_payload": Json }; Returns: {
              "revision": number,"version_id": string
            }[]
                           },
"cms_unarchive":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"cms_unpublish":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"log_admin_auth_event":
{ Args: { "p_action": string }; Returns: undefined
                           },
"record_consent":
{ Args: { "p_analytics": boolean,"p_marketing": boolean,"p_path": string,"p_rate_key": string,"p_subject": string,"p_version": string }; Returns: boolean
                           }
          }
          Enums: {
            "content_type": "home"|"page"|"treatment"|"technology"|"promotion"|"landing"|"blog_post"|"faq"|"team_member"|"testimonial","editorial_status": "draft"|"published"|"archived","lifecycle_status": "draft"|"published"|"unpublished"|"archived","media_status": "processing"|"private"|"published"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "content_type": ["home", "page", "treatment", "technology", "promotion", "landing", "blog_post", "faq", "team_member", "testimonial"],"editorial_status": ["draft", "published", "archived"],"lifecycle_status": ["draft", "published", "unpublished", "archived"],"media_status": ["processing", "private", "published", "archived"]
          }
        }
} as const
