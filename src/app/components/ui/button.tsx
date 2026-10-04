import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";


import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-curator-brass hover:text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-card text-foreground hover:bg-secondary hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-foreground hover:bg-secondary hover:text-foreground",
        link: "text-tool-blue underline-offset-4 hover:underline",
      },
      // Touch screens get the 44px minimum target; mouse layouts keep their compact sizes.
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3 pointer-coarse:min-h-11",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 pointer-coarse:min-h-11",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4 pointer-coarse:min-h-11",
        icon: "size-9 rounded-md pointer-coarse:min-h-11 pointer-coarse:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"button">, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const baseClassName = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    return <Slot data-slot="button" className={baseClassName} {...props} />;
  }



  return (
    <button
      data-slot="button"
      className={baseClassName}
      {...props}
    />
  );
}

function ButtonSparkle() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4 shrink-0 text-inherit"
    >
      <path d="M10,21.236,6.755,14.745.264,11.5,6.755,8.255,10,1.764l3.245,6.491L19.736,11.5l-6.491,3.245ZM18,21l1.5,3L21,21l3-1.5L21,18l-1.5-3L18,18l-3,1.5ZM19.333,4.667,20.5,7l1.167-2.333L24,3.5,21.667,2.333,20.5,0,19.333,2.333,17,3.5Z" />
    </svg>
  );
}

function ButtonText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block font-semibold text-inherit transition-colors duration-200",
        className,
      )}
      {...props}
    />
  );
}

export { Button, ButtonSparkle, ButtonText, buttonVariants };
