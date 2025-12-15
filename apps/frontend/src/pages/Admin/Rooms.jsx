import { useState, useEffect } from 'react'
import { roomsService } from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function Rooms() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [form, setForm] = useState({
    name: '',
    capacity: ''
  })

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      const response = await roomsService.getAll()
      setRooms(response.data.data)
    } catch (err) {
      toast.error('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (room = null) => {
    if (room) {
      setEditingRoom(room)
      setForm({ name: room.name, capacity: room.capacity || '' })
    } else {
      setEditingRoom(null)
      setForm({ name: '', capacity: '' })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        name: form.name,
        capacity: form.capacity ? parseInt(form.capacity) : null
      }

      if (editingRoom) {
        await roomsService.update(editingRoom.id, data)
        toast.success('Room updated')
      } else {
        await roomsService.create(data)
        toast.success('Room created')
      }
      setShowModal(false)
      loadRooms()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Operation failed')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      await roomsService.delete(id)
      toast.success('Room deleted')
      loadRooms()
    } catch (err) {
      toast.error('Failed to delete room')
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1>Rooms</h1>
          <p>Manage session locations and rooms</p>
        </div>
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => openModal()}>
          + Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="empty-state card">
          <h3>No rooms configured</h3>
          <p>Add rooms where sessions will take place</p>
          <button className="btn btn-primary mt-4" onClick={() => openModal()}>
            Add First Room
          </button>
        </div>
      ) : (
        <div className="flex flex-row gap-2 w-full flex-wrap justify-center items-center">
          {rooms.map(room => (
            <div key={room.id} className="card w-fit">
              <h3>{room.name}</h3>
              {room.capacity && (
                <p className="text-muted text-sm">Capacity: {room.capacity}</p>
              )}
              <p className="text-sm">{room.session_count} sessions</p>
              <div className="flex gap-2 mt-4">
                <button className="btn-gray-200 btn-outline btn-sm" onClick={() => openModal(room)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(room.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Room Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Hall A, Room 101"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity (optional)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g., 100"
                    value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRoom ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
