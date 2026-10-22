import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-zinc-800 text-zinc-200",
      success: "bg-emerald-800/80 text-emerald-100",
      warning: "bg-amber-700/80 text-amber-100",
      danger: "bg-red-800/80 text-red-100",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
