import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobs, useJob, useDLQ, useRetryDLQ, useClearDLQ } from '../hooks/useJobs'
import JobList from '../components/JobList'
import JobDetail from '../components/JobDetail'

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const { data: jobsData, isLoading: jobsLoading } = useJobs()
  const { data: selectedJob } = useJob(selectedJobId)
  const { data: dlqData } = useDLQ()
  const retryMutation = useRetryDLQ()
  const clearMutation = useClearDLQ()

  // Auto-select job from URL query param (e.g. ?selected=<job_id>)
  useEffect(() => {
    const id = searchParams.get('selected')
    if (id) {
      setSelectedJobId(id)
      // Clean the param from the URL so it doesn't stick on refresh
      searchParams.delete('selected')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const jobs = jobsData?.jobs ?? []
  const dlqEntries = dlqData?.entries ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">المهام</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Jobs list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-600">قائمة المهام</h2>
          </div>
          <JobList
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
            loading={jobsLoading}
          />
        </div>

        {/* Job detail */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-600">التفاصيل</h2>
          </div>
          {selectedJob ? (
            <JobDetail job={selectedJob} />
          ) : (
            <div className="p-6 text-center text-slate-400">
              اختر مهمة لعرض التفاصيل
            </div>
          )}
        </div>
      </div>

      {/* Dead Letter Queue */}
      {dlqEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-red-200 bg-red-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-700">
              المهام الفاشلة ({dlqEntries.length})
            </h2>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              مسح الكل
            </button>
          </div>
          <div className="divide-y divide-red-100">
            {dlqEntries.map((entry, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    كتاب #{entry.book_id}
                    <span className="text-xs text-slate-400 mr-2">
                      (مهمة {entry.job_id.slice(0, 8)})
                    </span>
                  </div>
                  <p className="text-xs text-red-500 mt-1">{entry.error}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(entry.failed_at).toLocaleString('ar-SA')}
                  </p>
                </div>
                <button
                  onClick={() => retryMutation.mutate(i)}
                  disabled={retryMutation.isPending}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
