import { requireK7Role } from '@/lib/partner/session'
import { K7_TRAINING } from '@/lib/partner/training'
import { CSV_TEMPLATE } from '@/lib/partner/training-model'

/* The question-bank template (FR-TRN-13): the columns the import reads with three sample rows, one per question type. */
export async function GET() {
  await requireK7Role(['trainingAdmin'], `${K7_TRAINING}/template.csv`)
  return new Response(`﻿${CSV_TEMPLATE}\n`, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="k7-question-bank-template.csv"', 'Cache-Control': 'private, no-store' } })
}
