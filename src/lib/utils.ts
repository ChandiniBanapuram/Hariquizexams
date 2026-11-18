import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number in Indian numbering system (lakhs, crores)
export function formatIndianNumber(num: number): string {
  return num.toLocaleString('en-IN');
}
