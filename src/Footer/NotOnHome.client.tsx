'use client'
import { usePathname } from 'next/navigation'
import React from 'react'

/* SiteFooter closes every page but the homepage, which closes with its own footer (HomeFooter, design-system HomeLanding). */
export const NotOnHome: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  usePathname() === '/' ? null : <>{children}</>
