import type { Job, BookJobStatusType } from '../types'

const bookStatusLabel: Record<BookJobStatusType, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'text-yellow-600' },
  in_progress: { label: 'جاري', color: 'text-blue-600' },
  completed: { label: 'مكتمل', color: 'text-green-600' },
  failed: { label: 'فشل', color: 'text-red-600' },
}

const stepLabels: Record<string, string> = {
  exporting: 'تصدير الملفات',
  chunking: 'تقطيع النص',
  embedding: 'توليد التضمينات',
  upserting: 'رفع إلى Milvus',
  uploading: 'رفع إلى S3',
}

function formatElapsed(seconds: number | null): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  job: Job
}

export default function JobDetail({ job }: Props) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800">تفاصيل المهمة</h3>
        <span className="font-mono text-xs text-slate-400">{job.job_id}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-slate-800">{job.total_books}</div>
          <div className="text-xs text-slate-500">إجمالي الكتب</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700">{job.completed_books}</div>
          <div className="text-xs text-green-600">مكتمل</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-700">{job.failed_books}</div>
          <div className="text-xs text-red-600">فشل</div>
        </div>
      </div>

      <div className="space-y-2">
        {job.books.map((b) => {
          const cfg = bookStatusLabel[b.status]
          const stepLabel = b.current_step ? stepLabels[b.current_step] || b.current_step : null
          const chunkProgress =
            b.total_chunks != null && b.total_chunks > 0 && b.chunks_embedded != null
              ? b.chunks_embedded / b.total_chunks
              : null

          return (
            <div
              key={b.book_id}
              className="p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-700">كتاب #{b.book_id}</span>
                  {b.error && (
                    <p className="text-xs text-red-500 mt-1">{b.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {b.elapsed_seconds != null && (
                    <span className="font-mono text-xs text-slate-400">
                      {formatElapsed(b.elapsed_seconds)}
                    </span>
                  )}
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              </div>

              {b.status === 'in_progress' && (
                <div className="mt-2 space-y-1.5">
                  {stepLabel && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-xs text-blue-600">{stepLabel}</span>
                    </div>
                  )}

                  {chunkProgress != null && b.current_step === 'embedding' && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
                        <span>التضمينات</span>
                        <span>{b.chunks_embedded} / {b.total_chunks}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.round(chunkProgress * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(b.status === 'completed' || b.status === 'failed') && b.total_chunks != null && (
                <div className="mt-1.5 text-xs text-slate-400">
                  {b.total_chunks} أجزاء
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 text-xs text-slate-400 space-y-1">
        <div>تم الإنشاء: {new Date(job.created_at).toLocaleString('ar-SA')}</div>
        <div>آخر تحديث: {new Date(job.updated_at).toLocaleString('ar-SA')}</div>
      </div>
    </div>
  )
}
