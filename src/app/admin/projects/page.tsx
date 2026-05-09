import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, FolderKanban } from "lucide-react"
import Link from "next/link"

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your projects and deliverables</p>
        </div>
        <Button className="bg-navy hover:bg-navy/90">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="text-gray-500 mt-1">Create your first project to get started</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}