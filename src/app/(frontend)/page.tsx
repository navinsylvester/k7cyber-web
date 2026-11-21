import { SeventhSenseHome } from '@/components/home/SeventhSense'
import { generateMetadata } from './[slug]/page'

import './home.css'

/* The homepage is the designed Seventh Sense landing (src/components/home): the site header's homepage variant above it, its
   own footer below. Its title, description and share image still come from the "home" page in /admin (SEO tab). */
export default function HomePage() {
  return <SeventhSenseHome />
}

export { generateMetadata }
