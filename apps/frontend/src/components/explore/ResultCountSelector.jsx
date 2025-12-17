export default function ResultCountSelector({ totalResults, onSelect, disabled }) {
  const options = []

  // Quick option (3-5)
  if (totalResults >= 3) {
    options.push({
      count: Math.min(5, totalResults),
      label: totalResults >= 5 ? 'Top 5' : `Top ${Math.min(5, totalResults)}`,
      description: 'Quick overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    })
  }

  // Standard option (10)
  if (totalResults > 5) {
    options.push({
      count: Math.min(10, totalResults),
      label: totalResults >= 10 ? 'Top 10' : `Top ${Math.min(10, totalResults)}`,
      description: 'Detailed analysis',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    })
  }

  // All option
  if (totalResults > 1) {
    options.push({
      count: totalResults,
      label: `All ${totalResults}`,
      description: 'Complete list',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    })
  }

  // If only 1-2 results, just show that
  if (options.length === 0) {
    options.push({
      count: totalResults,
      label: totalResults === 1 ? 'View Session' : `View ${totalResults} Sessions`,
      description: 'See all matches',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((option, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(option.count)}
          disabled={disabled}
          className={`
            flex flex-col items-center p-4 rounded-xl border-2 transition-all
            ${disabled
              ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
              : 'border-slate-200 hover:border-purple-500 hover:bg-purple-50 cursor-pointer'
            }
          `}
        >
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
            {option.icon}
          </div>
          <span className="font-semibold text-slate-800">{option.label}</span>
          <span className="text-xs text-slate-500">{option.description}</span>
        </button>
      ))}
    </div>
  )
}
