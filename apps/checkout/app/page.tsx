
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getStoreDomainByPayDomain } from '../lib/actions'

export default async function HomePage() {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  if (!host) return <></>

  const result = await getStoreDomainByPayDomain(host)
  if (result.success && result.domain) {
    redirect(`https://${result.domain}`)
  }

  return <></>
}