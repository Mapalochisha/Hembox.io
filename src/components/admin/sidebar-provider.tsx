"use client"

import { createContext, useContext, useState } from "react"

const SidebarContext = createContext<{
  isCollapsed: boolean
  toggleSidebar: () => void
}>({
  isCollapsed: false,
  toggleSidebar: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleSidebar = () => setIsCollapsed((prev) => !prev)

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
