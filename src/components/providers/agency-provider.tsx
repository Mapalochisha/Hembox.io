"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface AgencySettings {
  agency_name: string
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

const defaultSettings: AgencySettings = {
  agency_name: "Hembox.io",
  contact_email: "Mapalochisha@execs.com",
  phone_number: "+260 969 868508",
  whatsapp_number: "+260 969 868508",
  whatsapp_message: "Hi, I'm interested in your services!",
  about_us_content: "We build fast, beautiful sites that actually convert. No templates. No bloat. Just results.",
  terms_conditions: "",
  privacy_policy: "",
  instagram_url: "",
  facebook_url: "",
  twitter_url: "",
  linkedin_url: "",
}

const AgencyContext = createContext<AgencySettings>(defaultSettings)

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AgencySettings>(defaultSettings)

  useEffect(() => {
    const supabase = createClient()

    const fetchSettings = async () => {
      const { data } = await supabase
        .from('agency_settings')
        .select('*')
        .single()

      if (data) {
        setSettings({
          agency_name: data.agency_name,
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
      }
    }

    fetchSettings()
  }, [])

  return (
    <AgencyContext.Provider value={settings}>
      {children}
    </AgencyContext.Provider>
  )
}

export const useAgency = () => useContext(AgencyContext)
