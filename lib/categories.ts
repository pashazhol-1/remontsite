import type { Profile, UserRole, WorkCategory } from "@/types";

export function assignmentsEnabled(categories: WorkCategory[]) {
  return categories.some((category) => category.assigneeIds.length > 0);
}

export function categoriesForProfile(categories: WorkCategory[], profile: Profile | null) {
  const active = categories.filter((category) => category.isActive);
  if (!profile || profile.role === "admin" || !assignmentsEnabled(categories)) return active;
  return active.filter((category) => category.assigneeIds.includes(profile.id));
}

export function assertCategoryAllowed(
  categories: WorkCategory[],
  role: UserRole,
  userId: string,
  categoryId: string,
) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category || !category.isActive) throw new Error("Выберите вид работ");
  if (role === "builder" && assignmentsEnabled(categories) && !category.assigneeIds.includes(userId)) {
    throw new Error("Этот вид работ вам не назначен");
  }
  return category;
}
