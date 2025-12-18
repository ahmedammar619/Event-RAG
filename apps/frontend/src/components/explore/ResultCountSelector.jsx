// Robot Icon for AI
const RobotIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a1 1 0 011 1v2h3a3 3 0 013 3v2a1 1 0 01-1 1h-1v6a3 3 0 01-3 3H10a3 3 0 01-3-3v-6H6a1 1 0 01-1-1V8a3 3 0 013-3h3V3a1 1 0 011-1zM9 14a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zm-5-4a1 1 0 00-1 1v1a1 1 0 001 1h4a1 1 0 001-1v-1a1 1 0 00-1-1h-4z"/>
  </svg>
)

export default function ResultCountSelector({ totalResults, onSelect, disabled }) {
  const options = []

  // Always offer Top 3 if we have at least 3 results
  if (totalResults >= 3) {
    options.push({
      count: 3,
      label: 'Top 3',
      description: 'Quick analysis'
    })
  }

  // Offer Top 5 if we have at least 5 results
  if (totalResults >= 5) {
    options.push({
      count: 5,
      label: 'Top 5',
      description: 'Balanced analysis'
    })
  }

  // Offer Top 10 if we have at least 10 results
  if (totalResults >= 10) {
    options.push({
      count: 10,
      label: 'Top 10',
      description: 'Deep dive'
    })
  }

  // Add "All X" option if total doesn't match any fixed option
  if (totalResults > 0 && ![3, 5, 10].includes(totalResults)) {
    const lastOption = options[options.length - 1]
    if (!lastOption || lastOption.count < totalResults) {
      options.push({
        count: Math.min(totalResults, 10),
        label: totalResults <= 10 ? `All ${totalResults}` : 'Top 10',
        description: totalResults <= 10 ? 'Full analysis' : 'Maximum depth'
      })
    }
  }

  // If no options yet (less than 3 results), show single option
  if (options.length === 0 && totalResults > 0) {
    options.push({
      count: totalResults,
      label: totalResults === 1 ? 'Analyze' : `Analyze ${totalResults}`,
      description: 'Get AI explanation'
    })
  }

  // Remove duplicates
  const uniqueOptions = options.filter((opt, idx, arr) =>
    arr.findIndex(o => o.count === opt.count) === idx
  )

  return (
    <div className={`grid gap-4 ${uniqueOptions.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : uniqueOptions.length === 2 ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
      {uniqueOptions.map((option, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(option.count)}
          disabled={disabled}
          className={`
            group relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all
            ${disabled
              ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
              : 'border-purple-200 hover:border-purple-500 hover:bg-gradient-to-br hover:from-purple-50 hover:to-indigo-50 cursor-pointer hover:shadow-lg hover:shadow-purple-100'
            }
          `}
        >
          {/* AI Badge */}
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <RobotIcon className="w-3 h-3" />
            AI
          </div>

          {/* Count Circle */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 flex items-center justify-center mb-3 group-hover:from-purple-500 group-hover:to-indigo-500 group-hover:text-white transition-all shadow-sm">
            <span className="font-bold text-xl">{option.count}</span>
          </div>

          {/* Label */}
          <span className="font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">{option.label}</span>

          {/* Description with robot icon */}
          <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <RobotIcon className="w-3 h-3 text-purple-400" />
            {option.description}
          </span>
        </button>
      ))}
    </div>
  )
}
