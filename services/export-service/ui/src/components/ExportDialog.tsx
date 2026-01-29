interface Props {
  selectedCount: number
  onExport: () => void
  onClose: () => void
  loading?: boolean
}

export default function ExportDialog({ selectedCount, onExport, onClose, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">تصدير الكتب</h2>
        <p className="text-sm text-slate-600 mb-5">
          سيتم تصدير <span className="font-bold text-blue-600">{selectedCount}</span> كتاب.
          هل تريد المتابعة؟
        </p>

        <div className="flex gap-3">
          <button
            onClick={onExport}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإرسال...' : 'تصدير'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
