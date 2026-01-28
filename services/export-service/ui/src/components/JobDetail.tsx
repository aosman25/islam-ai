import type { Job, BookJobStatusType } from '../types'

const bookStatusLabel: Record<BookJobStatusType, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'text-yellow-600' },
  in_progress: { label: 'جاري', color: 'text-blue-600' },
  completed: { label: 'مكتمل', color: 'text-green-600' },
  failed: { label: 'فشل', color: 'text-red-600' },
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
          return (
            <div
              key={b.book_id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div>
                <span className="text-sm font-medium text-slate-700">كتاب #{b.book_id}</span>
                {b.error && (
                  <p className="text-xs text-red-500 mt-1">{b.error}</p>
                )}
              </div>
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
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
