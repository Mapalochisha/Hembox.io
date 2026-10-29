"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { BRAND_NAME } from "@/lib/brand"

export interface AgencySettings {
  contact_email: string
  phone_number: string
  whatsapp_number?: string
  whatsapp_message?: string
  about_us_content: string
  terms_conditions: string
  privacy_policy: string
  instagram_url?: string
  facebook_url?: string
  twitter_url?: string
  linkedin_url?: string
}

const AgencyContext = createContext<AgencySettings>({
  contact_email: "Mapalochisha@execs.com",
  phone_number: "+260 969 868508",
  whatsapp_number: "+260 969 868508",
  whatsapp_message: "Hi, I'm interested in your services!",
  about_us_content: `${BRAND_NAME} helps businesses build beyond boundaries with digital experiences, branding, applications, and technology solutions.`,
  terms_conditions: "",
  privacy_policy: "",
  instagram_url: "",
  facebook_url: "",
  twitter_url: "",
  linkedin_url: "",
})

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AgencySettings | null>(null)
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, [])

  useEffect(() => {
    if (!supabase) return

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
        .from('agency_settings')
        .select('contact_email, phone_number, whatsapp_number, whatsapp_message, about_us_content, terms_conditions, privacy_policy, instagram_url, facebook_url, twitter_url, linkedin_url')
        .single()

        if (error || !data) return

        setSettings({
          contact_email: data.contact_email,
          phone_number: data.phone_number,
          whatsapp_number: data.whatsapp_number || "",
          whatsapp_message: data.whatsapp_message || "Hi, I'm interested in your services!",
          about_us_content: data.about_us_content,
          terms_conditions: data.terms_conditions,
          privacy_policy: data.privacy_policy,
          instagram_url: data.instagram_url || "",
          facebook_url: data.facebook_url || "",
          twitter_url: data.twitter_url || "",
          linkedin_url: data.linkedin_url || "",
        })
      } catch (error) {
        // Keep the public site usable if the settings query is unavailable.
        console.warn("Unable to load agency settings:", error)
      }
    }

    void fetchSettings()
  }, [])

  return (
    <AgencyContext.Provider value={settings || {
      contact_email: "Mapalochisha@execs.com",
      phone_number: "+260 969 868508",
      whatsapp_number: "+260 969 868508",
      whatsapp_message: "Hi, I'm interested in your services!",
      about_us_content: `${BRAND_NAME} helps businesses build beyond boundaries with digital experiences, branding, applications, and technology solutions.`,
      terms_conditions: "",
      privacy_policy: "",
      instagram_url: "",
      facebook_url: "",
      twitter_url: "",
      linkedin_url: "",
    }}>
      {children}
    </AgencyContext.Provider>
  )
}

export const useAgency = () => useContext(AgencyContext)
