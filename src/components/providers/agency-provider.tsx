"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface AgencySettings {
  agency_name: string
  contact_email: string
  phone_number: string
  about_us_content: string
  terms_conditions: string
  privacy_policy: string
}

const AgencyContext = createContext<AgencySettings>({
  agency_name: "Hembox.io",
  contact_email: "hello@hembox.io",
  phone_number: "+1 (555) 000-0000",
  about_us_content: "We build fast, beautiful sites that actually convert. No templates. No bloat. Just results.",
  terms_conditions: "",
  privacy_policy: "",
})

export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AgencySettings | null>(null)
  const supabase = createClient()

  useEffect(() => {
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
          about_us_content: data.about_us_content,
          terms_conditions: data.terms_conditions,
          privacy_policy: data.privacy_policy,
        })
      }
    }

    fetchSettings()
  }, [])

  return (
    <AgencyContext.Provider value={settings || {
      agency_name: "Hembox.io",
      contact_email: "hello@hembox.io",
      phone_number: "+1 (555) 000-0000",
      about_us_content: "We build fast, beautiful sites that actually convert. No templates. No bloat. Just results.",
      terms_conditions: "",
      privacy_policy: "",
    }}>
      {children}
    </AgencyContext.Provider>
  )
}

export const useAgency = () => useContext(AgencyContext)
