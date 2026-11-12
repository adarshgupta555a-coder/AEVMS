"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "@/types/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface SidebarNavProps {
  groups: NavGroup[];
}

export function SidebarNav({ groups }: SidebarNavProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, groupIndex) => (
        <SidebarGroup key={group.groupLabel || groupIndex} className="p-0">
          {group.groupLabel && (
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.groupLabel}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {group.items.map((item) => (
                <SidebarNavModuleItem
                  key={item.title}
                  item={item}
                  pathname={pathname}
                  onNavigate={handleLinkClick}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
}

interface SidebarNavModuleItemProps {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}

function SidebarNavModuleItem({
  item,
  pathname,
  onNavigate,
}: SidebarNavModuleItemProps) {
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const hasSubItems = Boolean(item.items && item.items.length > 0);

  // Check if any child route is currently active
  const isChildActive = React.useMemo(() => {
    if (!item.items) return false;
    return item.items.some(
      (sub) => pathname === sub.href || pathname.startsWith(sub.href + "/")
    );
  }, [item.items, pathname]);

  const isDirectActive = item.href ? pathname === item.href : false;

  // Controlled open state for collapsible parent: auto-open if child active or default
  const [isOpen, setIsOpen] = React.useState<boolean>(() => {
    if (item.isExpandedByDefault) return true;
    return isChildActive;
  });

  // Adjust state during render when isChildActive changes (React recommended pattern)
  const [prevIsChildActive, setPrevIsChildActive] = React.useState(isChildActive);
  if (isChildActive !== prevIsChildActive) {
    setPrevIsChildActive(isChildActive);
    if (isChildActive) {
      setIsOpen(true);
    }
  }

  const Icon = item.icon;

  // Single top-level menu item without submenus (e.g., Executive Dashboard)
  if (!hasSubItems && item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          render={<Link href={item.href} onClick={onNavigate} />}
          isActive={isDirectActive}
          className={cn(
            "transition-colors duration-150 font-medium",
            isDirectActive
              ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className={cn("size-4 shrink-0", isDirectActive && "text-primary")} />
          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
          {item.badge !== undefined && (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary group-data-[collapsible=icon]:hidden">
              {item.badge}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const handleParentClick = () => {
    if (isCollapsed) {
      setOpen(true);
      setIsOpen(true);
    }
  };

  // Hierarchical parent module containing expandable submenus
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isChildActive}
              onClick={handleParentClick}
              className={cn(
                "cursor-pointer transition-colors duration-150 font-medium",
                isChildActive
                  ? "text-primary font-semibold bg-sidebar-accent/50"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            />
          }
        >
          <Icon className={cn("size-4 shrink-0", isChildActive && "text-primary")} />
          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
          <ChevronRight
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out group-data-[collapsible=icon]:hidden",
              isOpen && "rotate-90 text-foreground"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="transition-all duration-200">
          <SidebarMenuSub className="my-1 ml-4 border-l-2 border-border/60 pl-2">
            {item.items?.map((subItem) => {
              const isSubActive =
                pathname === subItem.href || pathname.startsWith(subItem.href + "/");

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    render={<Link href={subItem.href} onClick={onNavigate} />}
                    isActive={isSubActive}
                    className={cn(
                      "text-xs transition-colors duration-150",
                      isSubActive
                        ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{subItem.title}</span>
                    {subItem.badge !== undefined && (
                      <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {subItem.badge}
                      </span>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
