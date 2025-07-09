import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { EmploymentType } from "@/types"
import React from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateStaffId(userId: string, type: EmploymentType): string {
  const suffix = userId.slice(-3);
  return `${type}${suffix}`;
}

export function generateTaskId(): string {
  const dateFormatter = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 999) + 1;
  return `${dateFormatter}-${randomNum.toString().padStart(3, '0')}`;
}

export function formatCurrency(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ms-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ms-MY', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ms-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatMessageWithLinks(message: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return React.createElement(
        'a',
        {
          key: index,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-600 hover:text-blue-800 underline break-words overflow-wrap-anywhere'
        },
        part
      );
    }
    return part;
  });
}