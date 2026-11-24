import React from "react";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LinkType } from "@/types/product";

export interface BuyButtonProps {
  platform: string;
  link: string;
  linkType: LinkType;
  domain?: string;
  className?: string;
}

export function BuyButton({
  platform,
  link,
  linkType,
  domain,
  className,
}: BuyButtonProps) {
  const label = linkType === "direct" ? `Buy on ${platform}` : `Search on ${platform}`;

  return (
    <div className="inline-flex items-center gap-2">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "default", size: "default" }),
          "inline-flex items-center gap-1.5 font-medium",
          className
        )}
      >
        <span>{label}</span>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
      {domain && (
        <span className="text-xs text-muted-foreground font-normal">{domain}</span>
      )}
    </div>
  );
}

export default BuyButton;
