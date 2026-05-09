import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"

export default function MessagesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-gray-600 mt-1">Client communications and inquiries</p>
      </div>

      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No messages yet</h3>
            <p className="text-gray-500 mt-1">Client messages will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}