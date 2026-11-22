"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useInventoryCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../hooks/use-inventory";
import type { InventoryCategory } from "@/types/inventory.types";
import { toast } from "sonner";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  Package,
} from "lucide-react";

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
}: CategoryManagerDialogProps) {
  const { data: categories = [], isLoading, isError } = useInventoryCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Add form state
  const [isAdding, setIsAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");

  // Edit form state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  // Delete confirmation state
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const resetAddForm = () => {
    setNewName("");
    setNewDescription("");
    setIsAdding(false);
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Category name is required.");
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: trimmed,
        description: newDescription.trim() || undefined,
      });
      toast.success(`Category "${trimmed}" created successfully.`);
      resetAddForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create category.";
      toast.error(msg);
    }
  };

  const handleStartEdit = (category: InventoryCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description || "");
  };

  const handleUpdate = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty.");
      return;
    }

    try {
      await updateCategory.mutateAsync({
        id,
        data: {
          name: trimmed,
          description: editDescription.trim() || undefined,
        },
      });
      toast.success("Category updated successfully.");
      resetEditForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update category.";
      toast.error(msg);
    }
  };

  const handleDelete = async (category: InventoryCategory) => {
    const itemCount = category._count?.items ?? 0;
    if (itemCount > 0) {
      toast.error(
        `Cannot delete "${category.name}" because ${itemCount} item(s) are attached. Reassign or delete the items first.`
      );
      setDeletingId(null);
      return;
    }

    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success(`Category "${category.name}" deleted.`);
      setDeletingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete category.";
      toast.error(msg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FolderTree className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold">
                Equipment Categories
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Organize inventory into reusable classifications.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Add Category Section */}
          {!isAdding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="w-full border-dashed gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add New Category
            </Button>
          ) : (
            <form
              onSubmit={handleCreate}
              className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  New Category
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={resetAddForm}
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-category-name" className="text-xs">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-category-name"
                  placeholder="e.g. Stage Lighting, Audio & Acoustics"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-category-desc" className="text-xs">
                  Description <span className="text-muted-foreground text-[10px]">(Optional)</span>
                </Label>
                <Textarea
                  id="new-category-desc"
                  placeholder="Short note about equipment in this category..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="min-h-16 text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={resetAddForm}
                  disabled={createCategory.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  disabled={createCategory.isPending || !newName.trim()}
                >
                  {createCategory.isPending ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save Category"
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
              <span>Existing Categories</span>
              <span>{categories.length} total</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-xs">Loading categories...</span>
              </div>
            ) : isError ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="size-4 shrink-0" />
                <span>Failed to load categories. Please check your connection.</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1.5 border border-dashed rounded-lg">
                <Package className="size-6 text-muted-foreground/60" />
                <span className="text-xs font-medium">No categories found</span>
                <span className="text-[11px] text-muted-foreground/80">
                  Add your first category to organize items.
                </span>
              </div>
            ) : (
              categories.map((cat) => {
                const itemCount = cat._count?.items ?? 0;
                const isEditing = editingId === cat.id;
                const isDeleting = deletingId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-3 rounded-lg border border-primary/30 bg-accent/40 space-y-2.5"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Category Name</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="min-h-14 text-xs resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={resetEditForm}
                          disabled={updateCategory.isPending}
                        >
                          <X className="size-3" />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => handleUpdate(cat.id)}
                          disabled={updateCategory.isPending || !editName.trim()}
                        >
                          {updateCategory.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="group flex flex-col gap-1 p-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-foreground truncate">
                          {cat.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4.5 px-1.5 shrink-0"
                        >
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleStartEdit(cat)}
                          title="Edit Category"
                        >
                          <Pencil className="size-3 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeletingId(cat.id)}
                          title="Delete Category"
                        >
                          <Trash2 className="size-3 text-destructive/80 hover:text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {cat.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {cat.description}
                      </p>
                    )}

                    {/* Inline Delete Confirmation */}
                    {isDeleting && (
                      <div className="mt-2 p-2 rounded border border-destructive/30 bg-destructive/10 space-y-1.5">
                        <div className="flex items-start gap-1.5 text-xs text-destructive">
                          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                          <span className="text-[11px]">
                            {itemCount > 0
                              ? `Cannot delete! ${itemCount} items are assigned to this category.`
                              : `Are you sure you want to delete "${cat.name}"?`}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeletingId(null)}
                          >
                            Cancel
                          </Button>
                          {itemCount === 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="xs"
                              disabled={deleteCategory.isPending}
                              onClick={() => handleDelete(cat)}
                            >
                              {deleteCategory.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                "Confirm Delete"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <SheetFooter className="p-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
