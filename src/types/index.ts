export interface User {
  id: string
  email: string
  phone?: string
  full_name?: string
  avatar_url?: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  user_id: string
  company_name?: string
  industry?: string
  website?: string
  status: 'active' | 'inactive' | 'pending'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  description?: string
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'cancelled'
  budget?: number
  deadline?: string
  images: string[]
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
}