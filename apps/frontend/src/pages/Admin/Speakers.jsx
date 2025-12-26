import { useState, useEffect, useRef } from 'react'
import { speakersService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Speakers() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [speakers, setSpeakers] = useState([])
  const [uploadingId, setUploadingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all') // all, with_file, without_file
  const fileInputRef = useRef(null)
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(null)

  useEffect(() => {
    loadSpeakers()
  }, [])

  const loadSpeakers = async () => {
    try {
      const response = await speakersService.getAll()
      setSpeakers(response.data.data)
    } catch (err) {
      toast.error('Failed to load speakers')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = (speakerId) => {
    setSelectedSpeakerId(speakerId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSpeakerId) return

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }

    setUploadingId(selectedSpeakerId)
    try {
      await speakersService.uploadFile(selectedSpeakerId, file)
      toast.success('File uploaded successfully')
      loadSpeakers()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload file')
    } finally {
      setUploadingId(null)
      setSelectedSpeakerId(null)
      e.target.value = ''
    }
  }

  const handleRemoveFile = async (speakerId) => {
    if (!confirm('Remove this speaker\'s file?')) return

    try {
      await speakersService.removeFile(speakerId)
      toast.success('File removed')
      loadSpeakers()
    } catch (err) {
      toast.error('Failed to remove file')
    }
  }

  // Filter and search
  const filteredSpeakers = speakers.filter(speaker => {
    const matchesSearch = speaker.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'with_file' && speaker.file_url) ||
      (filter === 'without_file' && !speaker.file_url)
    return matchesSearch && matchesFilter
  })

  const stats = {
    total: speakers.length,
    withFile: speakers.filter(s => s.file_url).length,
    withoutFile: speakers.filter(s => !s.file_url).length
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="page-header">
        <h1>Speakers</h1>
        <p>{stats.total} speakers ({stats.withFile} with files, {stats.withoutFile} without)</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              className="form-input w-full"
              placeholder="Search speakers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('with_file')}
              className={`btn btn-sm ${filter === 'with_file' ? 'btn-primary' : 'btn-outline'}`}
            >
              With File ({stats.withFile})
            </button>
            <button
              onClick={() => setFilter('without_file')}
              className={`btn btn-sm ${filter === 'without_file' ? 'btn-primary' : 'btn-outline'}`}
            >
              No File ({stats.withoutFile})
            </button>
          </div>
        </div>
      </div>

      {/* Speakers List */}
      {filteredSpeakers.length === 0 ? (
        <div className="empty-state card">
          <h3>No speakers found</h3>
          <p>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Speaker</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">Sessions</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-600">File</th>
                  <th className="text-right p-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpeakers.map((speaker, index) => (
                  <tr
                    key={speaker.id}
                    className={index !== 0 ? 'border-t border-slate-200' : ''}
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{speaker.name}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-500">
                        {speaker.session_count || 0} session{speaker.session_count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="p-4">
                      {speaker.file_url ? (
                        <a
                          href={speaker.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          View PDF
                        </a>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-500 text-sm rounded-lg">
                          No file
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUploadClick(speaker.id)}
                          disabled={uploadingId === speaker.id}
                          className="btn btn-sm btn-primary"
                        >
                          {uploadingId === speaker.id ? (
                            'Uploading...'
                          ) : speaker.file_url ? (
                            'Replace'
                          ) : (
                            'Upload'
                          )}
                        </button>
                        {speaker.file_url && (
                          <button
                            onClick={() => handleRemoveFile(speaker.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
