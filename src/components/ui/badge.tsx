import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-white hover:bg-navy/80",
        secondary: "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200",
        destructive: "border-transparent bg-coral/10 text-coral hover:bg-coral/20",
        outline: "text-foreground",
        active: "border-transparent bg-teal/10 text-teal hover:bg-teal/20",
        inactive: "border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200",
        pending: "border-transparent bg-coral/10 text-coral hover:bg-coral/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }