import type { LucideIcon } from "lucide-react";

export interface NavSubItem {
  title: string;
  href: string;
  description?: string;
  badge?: string | number;
}

export interface NavItem {
  title: string;
  icon: LucideIcon;
  href?: string;
  items?: NavSubItem[];
  badge?: string | number;
  isExpandedByDefault?: boolean;
}

export interface NavGroup {
  groupLabel?: string;
  items: NavItem[];
}
