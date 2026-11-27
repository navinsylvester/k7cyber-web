'use server'

import { redirect } from 'next/navigation'

import { getSettings, saveSettings } from '@/lib/support/kpi-config'
import { asPeriod } from '@/lib/support/kpi-model'
import { allowedAudiences, AUDIENCES, DELIVERIES, isEmail, NOTIFY_DEFS, notificationMail, type Audience, type Delivery } from '@/lib/support/notify-model'
import { workspaceUrl } from '@/lib/support/notify'
import { sendMail } from '@/lib/support/mail'
import { requireManager } from '@/lib/support/session'

/* Saves the notification rules (09-portal-guide.md §4g) in one post: per entry its audiences and its delivery; the managers
   list, the KPI period and the retention. Everything else in the support settings is left as it was. */

const PATH = '/support/workspace/manage/notifications'
const s = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()

export async function saveNotificationsAction(form: FormData): Promise<void> {
  await requireManager()
  const cur = await getSettings()
  const rules = NOTIFY_DEFS.map((d) => {
    const posted = form.getAll(`r_${d.key}_aud`).map(String).filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a))
    const delivery = s(form, `r_${d.key}_delivery`)
    return { key: d.key, audiences: allowedAudiences(d.key, posted), delivery: (DELIVERIES as readonly string[]).includes(delivery) ? (delivery as Delivery) : d.delivery }
  })
  const managers = s(form, 'managers')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const bad = managers.filter((e) => !isEmail(e))
  if (bad.length) redirect(`${PATH}?error=${encodeURIComponent(`Not an email address: ${bad.slice(0, 3).join(', ')}.`)}`)
  const days = Number(s(form, 'retentionDays'))
  const next = {
    ...cur,
    notify: {
      enabled: form.get('enabled') === '1',
      rules,
      managers: [...new Set(managers)],
      kpiPeriod: asPeriod(s(form, 'kpiPeriod'), cur.notify.kpiPeriod),
      retentionDays: Number.isFinite(days) && days >= 1 ? Math.min(365, Math.round(days)) : cur.notify.retentionDays,
    },
  }
  try {
    await saveSettings(next)
  } catch (e) {
    redirect(`${PATH}?error=${encodeURIComponent(`Could not save: ${(e as Error).message.slice(0, 160)}`)}`)
  }
  redirect(`${PATH}?ok=saved`)
}

/** A test email to the signed-in manager's own address: what a notification looks like, and whether mail goes at all. */
export async function testNotificationAction(): Promise<void> {
  const me = await requireManager()
  if (!me.email) redirect(`${PATH}?error=${encodeURIComponent('Your sign-in has no email address.')}`)
  const mail = notificationMail({ subject: '[Test] A notification from the support workspace', body: `This is how the workspace writes to you, ${me.name || 'there'}: the subject, a line or two, and the link.`, link: workspaceUrl() })
  let q = 'ok=test-logged'
  try {
    const r = await sendMail({ to: me.email, ...mail })
    q = r.sent ? 'ok=test-sent' : r.suppressed?.length ? 'ok=test-suppressed' : 'ok=test-logged'
  } catch (e) {
    q = `error=${encodeURIComponent(`The mail server refused: ${(e as Error).message.slice(0, 160)}`)}`
  }
  redirect(`${PATH}?${q}`)
}
