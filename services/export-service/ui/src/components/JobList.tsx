import type { Job, JobStatusType } from '../types'

const statusConfig: Record<JobStatusType, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'جاري التنفيذ', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-800' },
  completed_with_errors: { label: 'مكتمل مع أخطاء', color: 'bg-orange-100 text-orange-800' },
  failed: { label: 'فشل', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'ملغاة', color: 'bg-slate-100 text-slate-800' },
}

interface Props {
  jobs: Job[]
  selectedJobId: string | null
  onSelect: (jobId: string) => void
  loading?: boolean
}

export default function JobList({ jobs, selectedJobId, onSelect, loading }: Props) {
  if (loading) {
    return <div className="p-6 text-center text-slate-400">جاري التحميل...</div>
  }

  if (jobs.length === 0) {
    return <div className="p-6 text-center text-slate-400">لا توجد مهام بعد</div>
  }

  return (
    <div className="divide-y divide-slate-100">
      {jobs.map((job) => {
        const cfg = statusConfig[job.status]
        const isActive = job.job_id === selectedJobId
        return (
          <div
            key={job.job_id}
            onClick={() => onSelect(job.job_id)}
            className={`p-4 cursor-pointer transition-colors ${
              isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-slate-500">{job.job_id.slice(0, 8)}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span>{job.total_books} كتاب</span>
              <span>
                {job.completed_books} مكتمل{job.failed_books > 0 && ` / ${job.failed_books} فشل`}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  job.status === 'cancelled' ? 'bg-slate-400' :
                  job.status === 'failed' ? 'bg-red-500' :
                  job.status === 'completed_with_errors' ? 'bg-orange-500' :
                  job.status === 'completed' ? 'bg-green-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.round(job.progress * 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              {new Date(job.created_at).toLocaleString('ar-SA')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
