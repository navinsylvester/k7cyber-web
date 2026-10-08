import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import { SiteHeader } from './Component.client'

export async function Header() {
  const data = await getCachedGlobal('header', 2)()
  return <SiteHeader data={data} />
}
